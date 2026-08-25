import type {
  AnswerBlock,
  GradingSummary,
  IndexedLine,
  Mapping,
  Question,
  QuestionSelection,
  SourcePage,
} from "@/types/exam";
import { normalizeAnswerBoxes, sanitizeBoxes } from "@/lib/boxes";
import { mergeGradingBatches, reconcileGrading, reconcileMappings } from "./reconcile";
import { chunk, mapWithConcurrency, withTimeout } from "@/lib/async";
import { GRADING_BATCH_SIZE, GRADING_CONCURRENCY, PROVIDER_TIMEOUT_MS } from "./config";
import {
  ANSWER_EXTRACTION_PROMPT,
  QUESTION_EXTRACTION_PROMPT,
  byQuestionForGrading,
  gradingPrompt,
  mappingPrompt,
  questionsFromLinesPrompt,
} from "./prompts";

// OpenRouter is a credits-billed alternative to Gemini's free tier — switch
// to it (AI_PROVIDER=openrouter) if Gemini's daily quota runs out. Model is
// overridable via OPENROUTER_MODEL. Defaults to the same model family as the
// primary provider (billed through OpenRouter's own arrangement with Google,
// on entirely separate infrastructure/quota from GEMINI_API_KEY) because
// non-grounding-specialized models (tested: gpt-4o-mini) produced visibly
// worse bounding boxes for the answer-highlight overlay.
const MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash-lite";
const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

function getApiKey(): string {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set. Add it to .env.local (see .env.example).");
  }
  return apiKey;
}

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('"code":429') || message.includes('"code": 429') || message.includes("rate limit");
}

/** Retries only transient rate-limit errors — anything else fails fast. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === attempts || !isRateLimitError(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, 2 ** attempt * 1000));
    }
  }
  throw new Error("unreachable");
}

export function toFriendlyError(err: unknown, fallback: string): string {
  if (isRateLimitError(err)) {
    return "OpenRouter's rate limit was hit. Wait a minute and try again, or switch AI_PROVIDER back to gemini.";
  }
  return err instanceof Error ? err.message : fallback;
}

type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

function pagesToContentParts(pages: SourcePage[]): ContentPart[] {
  return pages.flatMap((page): ContentPart[] => [
    { type: "text", text: `Page index ${page.pageIndex}:` },
    { type: "image_url", image_url: { url: page.dataUrl } },
  ]);
}

/**
 * OpenRouter proxies dozens of different model providers, so there's no
 * single native structured-output mechanism to rely on the way Gemini's
 * responseSchema works. Instead: json_object mode (widely supported) plus an
 * explicit shape description in the prompt text.
 */
async function generateJson<T>(promptText: string, shapeDescription: string, images: ContentPart[] = []): Promise<T> {
  const content: ContentPart[] = [
    { type: "text", text: `${promptText}\n\nRespond with ONLY a single JSON object of exactly this shape (no markdown fences, no extra commentary):\n${shapeDescription}` },
    ...images,
  ];

  const response = await withRetry(async () => {
    const res = await withTimeout(fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getApiKey()}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://veda-ai.local",
        "X-Title": "VedaAI",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content }],
        response_format: { type: "json_object" },
      }),
    }), PROVIDER_TIMEOUT_MS, "OpenRouter request");
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenRouter request failed: ${res.status} ${body}`);
    }
    return res.json();
  });

  const text = response.choices?.[0]?.message?.content ?? "{}";
  return JSON.parse(text) as T;
}

const BOX_SHAPE = `{"page": number, "yMin": 0-1000, "xMin": 0-1000, "yMax": 0-1000, "xMax": 0-1000}`;

export async function extractQuestions(pages: SourcePage[]): Promise<Question[]> {
  const shape = `{"questions": [{"number": string, "parentNumber": string|null, "text": string, "box": ${BOX_SHAPE}}]}`;
  const parsed = await generateJson<{ questions: Array<Omit<Question, "id">> }>(
    QUESTION_EXTRACTION_PROMPT,
    shape,
    pagesToContentParts(pages)
  );
  return parsed.questions.map((q) => ({
    ...q,
    id: crypto.randomUUID(),
    box: sanitizeBoxes([q.box])[0] ?? null,
  }));
}

/**
 * Text-only counterpart to extractQuestions, used when the question paper has a
 * real text layer. The model returns line IDs; the caller turns those into
 * measured geometry, so no coordinate originates from the model.
 */
export async function extractQuestionsFromLines(lines: IndexedLine[]): Promise<QuestionSelection[]> {
  const shape = `{"questions": [{"number": string, "parentNumber": string|null, "text": string, "lineIds": number[]}]}`;
  const parsed = await generateJson<{ questions: QuestionSelection[] }>(
    questionsFromLinesPrompt(lines),
    shape
  );
  return parsed.questions ?? [];
}

export async function extractAnswers(pages: SourcePage[]): Promise<AnswerBlock[]> {
  const shape = `{"answers": [{"transcript": string, "declaredLabel": string|null, "boxes": [${BOX_SHAPE}]}]}`;
  const parsed = await generateJson<{ answers: Array<Omit<AnswerBlock, "id">> }>(
    ANSWER_EXTRACTION_PROMPT,
    shape,
    pagesToContentParts(pages)
  );
  return parsed.answers.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
    boxes: normalizeAnswerBoxes(a.boxes),
  }));
}

export async function mapAnswersToQuestions(
  questions: Question[],
  answers: AnswerBlock[]
): Promise<Mapping[]> {
  const shape = `{"mappings": [{"questionId": string|null, "answerId": string|null, "status": "answered"|"unanswered"|"unmatched_answer", "confidence": 0-1, "reasoning": string}]}`;
  const parsed = await generateJson<{ mappings: Mapping[] }>(mappingPrompt(questions, answers), shape);
  return reconcileMappings(questions, answers, parsed.mappings);
}

export async function gradeAnswers(
  questions: Question[],
  answers: AnswerBlock[],
  mappings: Mapping[]
): Promise<GradingSummary> {
  const shape = `{"totalScore": number, "maxScore": number, "overallFeedback": string, "results": [{"questionId": string, "verdict": "correct"|"partially_correct"|"incorrect"|"ungraded", "score": number, "maxScore": number, "feedback": string}]}`;
  // Batched for the same reasons as the Gemini provider: better per-question
  // attention, no truncation on long papers, and independent batches overlap.
  const batches = chunk(byQuestionForGrading(questions, answers, mappings), GRADING_BATCH_SIZE);
  const graded = await mapWithConcurrency(batches, GRADING_CONCURRENCY, (batch) =>
    generateJson<GradingSummary>(gradingPrompt(batch), shape)
  );

  return reconcileGrading(questions, mergeGradingBatches(graded));
}
