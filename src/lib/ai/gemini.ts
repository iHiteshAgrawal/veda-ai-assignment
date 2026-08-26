import { GoogleGenAI, Type } from "@google/genai";
import type {
  AnswerBlock,
  GradingSummary,
  IndexedLine,
  Mapping,
  Question,
  QuestionSelection,
  SourcePage,
} from "@/types/exam";
import type { AnswerSelection, LineIndex } from "@/types/exam";
import { normalizeAnswerBoxes, sanitizeBoxes } from "@/lib/boxes";
import { mergeGradingBatches, reconcileGrading, reconcileMappings } from "./reconcile";
import { chunk, mapWithConcurrency, withTimeout } from "@/lib/async";
import { buildFriendlyError, withRateLimitRetry } from "./retry";
import { GRADING_BATCH_SIZE, GRADING_CONCURRENCY, PROVIDER_TIMEOUT_MS } from "./config";
import {
  ANSWER_EXTRACTION_PROMPT,
  QUESTION_EXTRACTION_PROMPT,
  byQuestionForGrading,
  gradingPrompt,
  mappingPrompt,
  answersFromLinesPrompt,
  questionsFromLinesPrompt,
} from "./prompts";

// Not the cheaper gemini-flash-lite-latest: that model ignored the required
// bounding-box schema, omitting `yMin` on 5 of 6 boxes, which leaves answers
// with no usable highlight region. A tighter free-tier quota beats data the
// UI can't render. Override via GEMINI_MODEL, or switch providers entirely
// with AI_PROVIDER=openrouter when this quota runs out.
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not set. Add it to .env.local (see .env.example)."
      );
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export const toFriendlyError = buildFriendlyError(
  "The AI provider's free-tier rate limit was hit. Wait a minute and try again " +
    "(check usage at https://ai.dev/rate-limit), or switch AI_PROVIDER to openrouter."
);

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function generateJson<T>(parts: Part[], schema: object): Promise<T> {
  const response = await withRateLimitRetry(() =>
    withTimeout(
      getClient().models.generateContent({
        model: MODEL,
        contents: [{ role: "user", parts }],
        config: { responseMimeType: "application/json", responseSchema: schema },
      }),
      PROVIDER_TIMEOUT_MS,
      "Gemini request"
    )
  );
  return JSON.parse(response.text ?? "{}") as T;
}

function pageToPart(page: SourcePage): Part {
  const match = page.dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error(`Malformed data URL for page ${page.pageIndex}`);
  const [, mimeType, data] = match;
  return { inlineData: { mimeType, data } };
}

/** Every page image part is preceded by a text label so the model's bbox `page` field is unambiguous. */
function pagesToParts(pages: SourcePage[]): Part[] {
  return pages.flatMap((page): Part[] => [{ text: `Page index ${page.pageIndex}:` }, pageToPart(page)]);
}

const boxSchema = {
  type: Type.OBJECT,
  properties: {
    page: { type: Type.INTEGER, description: "0-based page index this box belongs to" },
    yMin: { type: Type.INTEGER, description: "0-1000 normalized" },
    xMin: { type: Type.INTEGER, description: "0-1000 normalized" },
    yMax: { type: Type.INTEGER, description: "0-1000 normalized" },
    xMax: { type: Type.INTEGER, description: "0-1000 normalized" },
  },
  required: ["page", "yMin", "xMin", "yMax", "xMax"],
};

export async function extractQuestions(pages: SourcePage[]): Promise<Question[]> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            number: { type: Type.STRING, description: 'Printed number exactly as shown, e.g. "11" or "11(a)"' },
            parentNumber: {
              type: Type.STRING,
              nullable: true,
              description: 'Parent number if this is a labelled sub-part, e.g. "11" for "11(a)". Null if not a sub-part.',
            },
            text: { type: Type.STRING, description: "Full text of the question, sub-part label excluded" },
            box: boxSchema,
          },
          required: ["number", "parentNumber", "text", "box"],
        },
      },
    },
    required: ["questions"],
  };

  const parsed = await generateJson<{ questions: Array<Omit<Question, "id">> }>(
    [{ text: QUESTION_EXTRACTION_PROMPT }, ...pagesToParts(pages)],
    schema
  );

  return parsed.questions.map((q) => ({
    ...q,
    id: crypto.randomUUID(),
    box: sanitizeBoxes([q.box])[0] ?? null,
  }));
}

/**
 * Text-only counterpart to extractQuestions, used when the question paper has a
 * real text layer. Cheaper and faster than the vision call, and the geometry it
 * yields is measured rather than estimated — the model only returns line IDs.
 */
export async function extractQuestionsFromLines(lines: IndexedLine[]): Promise<QuestionSelection[]> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            number: { type: Type.STRING },
            parentNumber: { type: Type.STRING, nullable: true },
            text: { type: Type.STRING },
            lineIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ["number", "parentNumber", "text", "lineIds"],
        },
      },
    },
    required: ["questions"],
  };

  const parsed = await generateJson<{ questions: QuestionSelection[] }>(
    [{ text: questionsFromLinesPrompt(lines) }],
    schema
  );
  return parsed.questions ?? [];
}

export async function extractAnswers(pages: SourcePage[]): Promise<AnswerBlock[]> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      answers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING, description: "Best-effort transcription of the handwriting" },
            declaredLabel: {
              type: Type.STRING,
              nullable: true,
              description: 'The question number/label the student wrote next to this answer, if legible, e.g. "Q11(a)". Null if none is visible.',
            },
            boxes: {
              type: Type.ARRAY,
              items: boxSchema,
              description: "One box per contiguous region. Multiple boxes if this single answer visibly continues across regions/pages.",
            },
          },
          required: ["transcript", "declaredLabel", "boxes"],
        },
      },
    },
    required: ["answers"],
  };

  const parsed = await generateJson<{ answers: Array<Omit<AnswerBlock, "id">> }>(
    [{ text: ANSWER_EXTRACTION_PROMPT }, ...pagesToParts(pages)],
    schema
  );

  return parsed.answers.map((a) => ({
    ...a,
    id: crypto.randomUUID(),
    boxes: normalizeAnswerBoxes(a.boxes),
  }));
}

/**
 * Answer extraction with measured geometry. The model still reads the
 * handwriting from the page images — it transcribes better than the OCR engine
 * — but returns location as line IDs from the measured index instead of
 * coordinates of its own, so the resulting boxes are exact.
 */
export async function extractAnswersFromLines(
  pages: SourcePage[],
  index: LineIndex
): Promise<AnswerSelection[]> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      answers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            declaredLabel: { type: Type.STRING, nullable: true },
            lineIds: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          },
          required: ["transcript", "declaredLabel", "lineIds"],
        },
      },
    },
    required: ["answers"],
  };

  const parsed = await generateJson<{ answers: AnswerSelection[] }>(
    [{ text: answersFromLinesPrompt(index.lines) }, ...pagesToParts(pages)],
    schema
  );
  return parsed.answers ?? [];
}

export async function mapAnswersToQuestions(
  questions: Question[],
  answers: AnswerBlock[]
): Promise<Mapping[]> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      mappings: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionId: { type: Type.STRING, nullable: true },
            answerId: { type: Type.STRING, nullable: true },
            status: { type: Type.STRING, enum: ["answered", "unanswered", "unmatched_answer"] },
            confidence: { type: Type.NUMBER },
            reasoning: { type: Type.STRING },
          },
          required: ["questionId", "answerId", "status", "confidence", "reasoning"],
        },
      },
    },
    required: ["mappings"],
  };

  const parsed = await generateJson<{ mappings: Mapping[] }>(
    [{ text: mappingPrompt(questions, answers) }],
    schema
  );
  return reconcileMappings(questions, answers, parsed.mappings);
}

export async function gradeAnswers(
  questions: Question[],
  answers: AnswerBlock[],
  mappings: Mapping[]
): Promise<GradingSummary> {
  const schema = {
    type: Type.OBJECT,
    properties: {
      totalScore: { type: Type.NUMBER },
      maxScore: { type: Type.NUMBER },
      overallFeedback: { type: Type.STRING },
      results: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionId: { type: Type.STRING },
            verdict: { type: Type.STRING, enum: ["correct", "partially_correct", "incorrect", "ungraded"] },
            score: { type: Type.NUMBER },
            maxScore: { type: Type.NUMBER },
            feedback: { type: Type.STRING },
          },
          required: ["questionId", "verdict", "score", "maxScore", "feedback"],
        },
      },
    },
    required: ["totalScore", "maxScore", "overallFeedback", "results"],
  };

  // Graded in batches rather than one giant call: a long paper in a single
  // request degrades per-question attention and risks truncation, and batching
  // lets independent batches run concurrently. Concurrency stays capped so the
  // fan-out doesn't trip the provider's per-minute limit.
  const batches = chunk(byQuestionForGrading(questions, answers, mappings), GRADING_BATCH_SIZE);
  const graded = await mapWithConcurrency(batches, GRADING_CONCURRENCY, (batch) =>
    generateJson<GradingSummary>([{ text: gradingPrompt(batch) }], schema)
  );

  return reconcileGrading(questions, mergeGradingBatches(graded));
}
