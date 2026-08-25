/**
 * Prompt text shared by every provider implementation, so tuning a prompt
 * doesn't mean tuning it twice. Each provider still encodes the expected
 * output shape in whatever mechanism it natively supports (Gemini's typed
 * responseSchema vs. a plain-JSON-object instruction for others).
 */
import type { AnswerBlock, IndexedLine, Mapping, Question } from "@/types/exam";

/**
 * Used when the document has a real text layer, so geometry is already known.
 * The model never sees the page image and never emits a coordinate — it groups
 * pre-measured lines by ID, and we union those lines' real boxes afterwards.
 */
export function questionsFromLinesPrompt(lines: readonly IndexedLine[]): string {
  return `Below are the text lines of an exam question paper, in printed order, each with a stable numeric id.

${lines.map((l) => `${l.id}: ${l.text}`).join("\n")}

Group these lines into exam questions.

Rules:
- Return every question in printed order.
- Treat labelled sub-parts as SEPARATE entries. If question 11 has parts (a) and (b), emit two
  entries, "11(a)" and "11(b)", both with parentNumber "11". Otherwise parentNumber is null.
- Preserve the printed numbering exactly (roman numerals, letters, etc.).
- lineIds must list every line belonging to that question, including continuation lines where
  the question text wraps. Use only ids from the list above; never invent one.
- Ignore lines that are not part of a question (titles, headers, page numbers, instructions).
- text is the question's wording with its number/label stripped off.`;
}

export const QUESTION_EXTRACTION_PROMPT = `You are extracting questions from a scanned/photographed exam question paper.
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

export const ANSWER_EXTRACTION_PROMPT = `You are extracting a student's handwritten answers from a scanned/photographed answer sheet.
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

export function mappingPrompt(questions: Question[], answers: AnswerBlock[]): string {
  return `Match each student answer block to the question it answers.

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
}

export function gradingPrompt(
  byQuestion: Array<{ id: string; number: string; question: string; studentAnswer: string | null }>
): string {
  return `Grade each question using the question text and the student's transcribed answer.
Assume a default maxScore of 10 per question unless the question text states otherwise.
If studentAnswer is null, verdict is "ungraded", score is 0, and feedback should note it was left unanswered.
Be specific and constructive in feedback — point at what's missing or wrong, not just "incorrect".

${JSON.stringify(byQuestion, null, 2)}`;
}

export function byQuestionForGrading(
  questions: Question[],
  answers: AnswerBlock[],
  mappings: Mapping[]
) {
  return questions.map((q) => {
    const mapping = mappings.find((m) => m.questionId === q.id);
    const answer = mapping?.answerId ? answers.find((a) => a.id === mapping.answerId) : undefined;
    return { id: q.id, number: q.number, question: q.text, studentAnswer: answer?.transcript ?? null };
  });
}
