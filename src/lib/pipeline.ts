/**
 * Client-side pipeline orchestration.
 *
 * Two things matter here beyond calling the routes in order:
 *
 *  1. The question-paper and answer-sheet branches are independent until the
 *     mapping step, so they run concurrently. The critical path becomes the
 *     slower branch rather than the sum of both.
 *  2. When the question paper is a digital PDF, its text layer already carries
 *     exact positions. That path sends text instead of images and asks the
 *     model to select line IDs, so the resulting geometry is measured rather
 *     than generated. Scans and photos fall back to the vision path.
 */
import type {
  AnswerBlock,
  ExamSession,
  GradingSummary,
  Mapping,
  PipelineStage,
  Question,
  QuestionSelection,
  SourcePage,
} from "@/types/exam";
import { rasterizeFile } from "./rasterize";
import { boxesForLineIds, extractLineIndex } from "./text-layer";

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `Request to ${url} failed`);
  return data as T;
}

export interface PipelineCallbacks {
  onStage: (stage: PipelineStage) => void;
  signal?: AbortSignal;
}

/**
 * Question paper -> questions. Prefers the text layer; falls back to vision.
 * Returns whether geometry was measured, which is worth surfacing since it's
 * the difference between exact and estimated highlight regions.
 */
async function extractQuestionsForFile(
  file: File,
  pages: SourcePage[],
  signal?: AbortSignal
): Promise<{ questions: Question[]; geometry: "measured" | "estimated" }> {
  const lineIndex = await extractLineIndex(file);

  if (lineIndex) {
    const { questions: selections } = await postJson<{ questions: QuestionSelection[] }>(
      "/api/extract-questions-from-lines",
      { lines: lineIndex.lines },
      signal
    );

    // Only keep selections that resolved to real lines; a question whose ids
    // matched nothing has no geometry and would render as a phantom highlight.
    const questions = selections
      .map((selection) => {
        const boxes = boxesForLineIds(lineIndex, selection.lineIds);
        return {
          id: crypto.randomUUID(),
          number: selection.number,
          parentNumber: selection.parentNumber,
          text: selection.text,
          box: boxes[0] ?? null,
        };
      })
      .filter((q) => q.text.trim().length > 0);

    if (questions.length > 0) return { questions, geometry: "measured" };
    // An empty result means the text layer existed but wasn't parseable as
    // questions — fall through to vision rather than showing an empty paper.
  }

  const { questions } = await postJson<{ questions: Question[] }>(
    "/api/extract-questions",
    { pages },
    signal
  );
  return { questions, geometry: "estimated" };
}

export async function runPipeline(
  questionPaperFile: File,
  answerSheetFile: File,
  { onStage, signal }: PipelineCallbacks
): Promise<ExamSession> {
  onStage("uploading");
  const [questionPaperPages, answerSheetPages] = await Promise.all([
    rasterizeFile(questionPaperFile),
    rasterizeFile(answerSheetFile),
  ]);

  // Both branches are independent of each other — the only join is the mapping
  // step below, so there's no reason to serialise them.
  onStage("extracting");
  const [questionResult, answerResult] = await Promise.all([
    extractQuestionsForFile(questionPaperFile, questionPaperPages, signal),
    postJson<{ answers: AnswerBlock[]; geometry: "measured" | "estimated" }>(
      "/api/extract-answers",
      { pages: answerSheetPages },
      signal
    ),
  ]);
  const { questions, geometry } = questionResult;
  const answers = answerResult.answers;

  onStage("mapping");
  const { mappings } = await postJson<{ mappings: Mapping[] }>(
    "/api/map-answers",
    { questions, answers },
    signal
  );

  onStage("grading");
  const { grading } = await postJson<{ grading: GradingSummary }>(
    "/api/grade",
    { questions, answers, mappings },
    signal
  );

  onStage("done");
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    stage: "done",
    error: null,
    questionGeometry: geometry,
    answerGeometry: answerResult.geometry,
    questionPaperPages,
    answerSheetPages,
    questions,
    answers,
    mappings,
    grading,
  };
}
