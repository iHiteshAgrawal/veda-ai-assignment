/**
 * Shared data model for the question-paper / answer-sheet pipeline.
 *
 * Pipeline: Question Extraction -> Answer Extraction -> Answer Mapping -> Grading/Feedback.
 * Each stage is a separate API call so the UI can show per-stage progress.
 */

/** A single rasterized page of an uploaded document (PDF page or standalone image). */
export interface SourcePage {
  pageIndex: number; // 0-based, order preserved from the original file
  dataUrl: string; // "data:image/jpeg;base64,...", rasterized client-side
  width: number;
  height: number;
}

/**
 * A rectangular region on one page, normalized to [0, 1000] on both axes
 * (matches Gemini's documented bounding-box convention), independent of the
 * page's actual pixel dimensions.
 */
export interface NormalizedBox {
  page: number; // index into the relevant SourcePage[] array
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
}

export interface Question {
  id: string;
  /** Printed numbering exactly as it appears, e.g. "11", "11(a)". */
  number: string;
  /** Parent number for a labelled sub-part, e.g. "11" for question "11(a)". */
  parentNumber: string | null;
  text: string;
  box: NormalizedBox;
}

export interface AnswerBlock {
  id: string;
  /** Best-effort transcription of the handwriting. */
  transcript: string;
  /** The label the student wrote next to the answer, if legible (e.g. "Q11 (a)"). */
  declaredLabel: string | null;
  /** One or more regions — an answer may span multiple pages. */
  boxes: NormalizedBox[];
}

export type MappingStatus =
  | "answered" // matched 1:1 to a question
  | "unanswered" // question has no matching answer block
  | "unmatched_answer"; // answer block doesn't correspond to any known question

export interface Mapping {
  questionId: string | null;
  answerId: string | null;
  status: MappingStatus;
  confidence: number; // 0-1
  /** Short rationale from the model, useful for debugging + surfacing low-confidence matches. */
  reasoning: string;
}

export type Verdict = "correct" | "partially_correct" | "incorrect" | "ungraded";

export interface GradingResult {
  questionId: string;
  verdict: Verdict;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface GradingSummary {
  totalScore: number;
  maxScore: number;
  overallFeedback: string;
  results: GradingResult[];
}

export type PipelineStage =
  | "idle"
  | "uploading"
  | "extracting_questions"
  | "extracting_answers"
  | "mapping"
  | "grading"
  | "done"
  | "error";

export interface ExamSession {
  id: string;
  createdAt: number;
  stage: PipelineStage;
  error: string | null;
  questionPaperPages: SourcePage[];
  answerSheetPages: SourcePage[];
  questions: Question[];
  answers: AnswerBlock[];
  mappings: Mapping[];
  grading: GradingSummary | null;
}
