import { GoogleGenAI, Type } from "@google/genai";
import type {
  AnswerBlock,
  GradingSummary,
  Mapping,
  Question,
  SourcePage,
} from "@/types/exam";

const MODEL = "gemini-2.5-flash";

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

function pageToPart(page: SourcePage) {
  const match = page.dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) throw new Error(`Malformed data URL for page ${page.pageIndex}`);
  const [, mimeType, data] = match;
  return { inlineData: { mimeType, data } };
}

/** Every page image part is preceded by a text label so the model's bbox `page` field is unambiguous. */
function pagesToParts(pages: SourcePage[]) {
  return pages.flatMap((page) => [{ text: `Page index ${page.pageIndex}:` }, pageToPart(page)]);
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

  const prompt = `You are extracting questions from a scanned/photographed exam question paper.
The pages are provided in printed order, each preceded by "Page index N:".

Rules:
- Extract every question in the exact order they are printed.
- Treat labelled sub-parts as SEPARATE entries. E.g. if question 11 has parts (a) and (b), emit two
  entries with number "11(a)" and "11(b)", both with parentNumber "11". If a question has no
  sub-parts, parentNumber is null and number is just the printed number, e.g. "7".
- Preserve the original numbering exactly as printed (including roman numerals, letters, etc. if used).
- For each question, return a bounding box (0-1000 normalized per axis) tightly around that
  question's text block on the page it appears on.
- Do not invent questions that aren't printed on the page. Do not merge separate questions together.`;

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }, ...pagesToParts(pages)] }],
    config: { responseMimeType: "application/json", responseSchema: schema },
  });

  const parsed = JSON.parse(response.text ?? "{}") as {
    questions: Array<Omit<Question, "id">>;
  };

  return parsed.questions.map((q) => ({ id: crypto.randomUUID(), ...q }));
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

  const prompt = `You are extracting a student's handwritten answers from a scanned/photographed answer sheet.
The pages are provided in physical order, each preceded by "Page index N:".

Rules:
- Segment the handwriting into answer blocks — one block per distinct answer attempt, in the order
  they physically appear (the student may have answered out of order relative to the question paper).
- If a label like "Q11", "11 (a)", "Ans 3" etc. is legibly written near a block, capture it verbatim
  in declaredLabel; otherwise null. Do not guess a label that isn't actually written down.
- If an answer clearly continues onto a later page or region (e.g. "contd. on next page", or an
  unbroken train of thought resuming under the same declared label), keep it as ONE answer block
  with multiple boxes rather than splitting it into separate blocks.
- Transcribe the handwriting as faithfully as you can, including crossed-out text noted as such.
- Every box must be 0-1000 normalized per axis, tightly bounding the handwritten region.`;

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }, ...pagesToParts(pages)] }],
    config: { responseMimeType: "application/json", responseSchema: schema },
  });

  const parsed = JSON.parse(response.text ?? "{}") as {
    answers: Array<Omit<AnswerBlock, "id">>;
  };

  return parsed.answers.map((a) => ({ id: crypto.randomUUID(), ...a }));
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

  const prompt = `Match each student answer block to the question it answers.

Questions (in printed order):
${JSON.stringify(questions.map((q) => ({ id: q.id, number: q.number, text: q.text })), null, 2)}

Answer blocks (in physical order on the answer sheet):
${JSON.stringify(
  answers.map((a) => ({ id: a.id, declaredLabel: a.declaredLabel, transcript: a.transcript })),
  null,
  2
)}

Rules:
- Match primarily on declaredLabel against question number when present and unambiguous.
- Otherwise, match on the semantic content of the transcript against the question text.
- The student may have answered out of order — physical order on the answer sheet does not need
  to match printed question order.
- Every question must appear in exactly one mapping. If no answer block matches it, emit
  { questionId, answerId: null, status: "unanswered", confidence: 1, reasoning }.
- Every answer block must appear in exactly one mapping. If it doesn't correspond to any known
  question (e.g. illegible, or answering a question not on this paper), emit
  { questionId: null, answerId, status: "unmatched_answer", confidence, reasoning }.
- A matched pair is { questionId, answerId, status: "answered", confidence, reasoning }.
- confidence is 0-1, your genuine confidence in that specific match.`;

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: schema },
  });

  const parsed = JSON.parse(response.text ?? "{}") as { mappings: Mapping[] };
  return parsed.mappings;
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

  const byQuestion = questions.map((q) => {
    const mapping = mappings.find((m) => m.questionId === q.id);
    const answer = mapping?.answerId ? answers.find((a) => a.id === mapping.answerId) : undefined;
    return { id: q.id, number: q.number, question: q.text, studentAnswer: answer?.transcript ?? null };
  });

  const prompt = `Grade each question using the question text and the student's transcribed answer.
Assume a default maxScore of 10 per question unless the question text states otherwise.
If studentAnswer is null, verdict is "ungraded", score is 0, and feedback should note it was left unanswered.
Be specific and constructive in feedback — point at what's missing or wrong, not just "incorrect".

${JSON.stringify(byQuestion, null, 2)}`;

  const response = await getClient().models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: { responseMimeType: "application/json", responseSchema: schema },
  });

  return JSON.parse(response.text ?? "{}") as GradingSummary;
}
