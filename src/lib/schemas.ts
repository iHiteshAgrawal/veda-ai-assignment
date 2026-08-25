import { z } from "zod";

/**
 * Request validation at the API boundary. These routes accept multi-megabyte
 * page images and arrays that get interpolated straight into model prompts, so
 * a malformed body should fail with a clear 400 rather than surfacing as a
 * confusing provider error — or as a large bill for a request that was never
 * going to work.
 */

const normalizedBox = z.object({
  page: z.number().int().min(0),
  yMin: z.number(),
  xMin: z.number(),
  yMax: z.number(),
  xMax: z.number(),
});

const sourcePage = z.object({
  pageIndex: z.number().int().min(0),
  dataUrl: z.string().startsWith("data:image/"),
  width: z.number().positive(),
  height: z.number().positive(),
});

const question = z.object({
  id: z.string().min(1),
  number: z.string(),
  parentNumber: z.string().nullable(),
  text: z.string(),
  box: normalizedBox.nullable(),
});

const answerBlock = z.object({
  id: z.string().min(1),
  transcript: z.string(),
  declaredLabel: z.string().nullable(),
  boxes: z.array(normalizedBox),
});

const mapping = z.object({
  questionId: z.string().nullable(),
  answerId: z.string().nullable(),
  status: z.enum(["answered", "unanswered", "unmatched_answer"]),
  confidence: z.number(),
  reasoning: z.string(),
});

const indexedLine = z.object({
  id: z.number().int().min(0),
  text: z.string(),
  box: normalizedBox,
});

// Caps chosen to reject obvious abuse while leaving real exam papers room:
// a long paper is tens of pages and a few thousand lines, not thousands of pages.
const MAX_PAGES = 40;
const MAX_LINES = 5_000;

export const extractQuestionsBody = z.object({
  pages: z.array(sourcePage).min(1).max(MAX_PAGES),
});

export const extractQuestionsFromLinesBody = z.object({
  lines: z.array(indexedLine).min(1).max(MAX_LINES),
});

export const extractAnswersBody = z.object({
  pages: z.array(sourcePage).min(1).max(MAX_PAGES),
});

export const mapAnswersBody = z.object({
  questions: z.array(question),
  answers: z.array(answerBlock),
});

export const gradeBody = z.object({
  questions: z.array(question),
  answers: z.array(answerBlock),
  mappings: z.array(mapping),
});
