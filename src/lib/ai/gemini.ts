import { GoogleGenAI, Type } from "@google/genai";
import type {
  AnswerBlock,
  GradingSummary,
  Mapping,
  Question,
  SourcePage,
} from "@/types/exam";
import { normalizeAnswerBoxes, sanitizeBoxes } from "@/lib/boxes";
import { reconcileGrading, reconcileMappings } from "./reconcile";
import {
  ANSWER_EXTRACTION_PROMPT,
  QUESTION_EXTRACTION_PROMPT,
  byQuestionForGrading,
  gradingPrompt,
  mappingPrompt,
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

function isRateLimitError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes('"code":429') || message.includes("RESOURCE_EXHAUSTED");
}

/** Retries only transient rate-limit errors (free-tier per-minute caps) — anything else fails fast. */
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

/** Turns the raw Gemini SDK error into something worth showing a teacher, without hiding real bugs. */
export function toFriendlyError(err: unknown, fallback: string): string {
  if (isRateLimitError(err)) {
    return "The AI provider's free-tier rate limit was hit. Wait a minute and try again (check usage at https://ai.dev/rate-limit), or switch AI_PROVIDER to openrouter.";
  }
  return err instanceof Error ? err.message : fallback;
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

async function generateJson<T>(parts: Part[], schema: object): Promise<T> {
  const response = await withRetry(() =>
    getClient().models.generateContent({
      model: MODEL,
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json", responseSchema: schema },
    })
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

  const prompt = gradingPrompt(byQuestionForGrading(questions, answers, mappings));
  return reconcileGrading(questions, await generateJson<GradingSummary>([{ text: prompt }], schema));
}
