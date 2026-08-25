import type { AnswerBlock, GradingSummary, Mapping, Question } from "@/types/exam";

/**
 * The mapping step is the one place where a sloppy model response corrupts
 * everything downstream — a wrong pairing feeds the wrong text to grading and
 * highlights the wrong region on the sheet. Observed failures in testing:
 *
 *  - rows tagged "unmatched_answer" that still carry a questionId, i.e. a
 *    question paired to an answer *and* declared unmatched at the same time
 *  - a genuine answer left orphaned while its question was paired elsewhere
 *  - the same answer claimed by more than one question
 *
 * Rather than trust the model to be self-consistent, keep only the pairings it
 * states unambiguously and derive everything else. The result satisfies by
 * construction: every question appears exactly once, every answer at most once,
 * and each row's ids agree with its status.
 */
export function reconcileMappings(
  questions: Question[],
  answers: AnswerBlock[],
  raw: Mapping[]
): Mapping[] {
  const questionIds = new Set(questions.map((q) => q.id));
  const answerIds = new Set(answers.map((a) => a.id));

  const claimedQuestions = new Set<string>();
  const claimedAnswers = new Set<string>();
  const pairs: Mapping[] = [];

  for (const mapping of Array.isArray(raw) ? raw : []) {
    const { questionId, answerId } = mapping;
    // Only unambiguous pairings survive: status must agree with the ids present,
    // both must exist, and neither side may already be spoken for.
    if (mapping.status !== "answered") continue;
    if (!questionId || !answerId) continue;
    if (!questionIds.has(questionId) || !answerIds.has(answerId)) continue;
    if (claimedQuestions.has(questionId) || claimedAnswers.has(answerId)) continue;

    claimedQuestions.add(questionId);
    claimedAnswers.add(answerId);
    pairs.push({
      questionId,
      answerId,
      status: "answered",
      confidence: typeof mapping.confidence === "number" ? mapping.confidence : 0.5,
      reasoning: mapping.reasoning ?? "",
    });
  }

  const unanswered: Mapping[] = questions
    .filter((q) => !claimedQuestions.has(q.id))
    .map((q) => ({
      questionId: q.id,
      answerId: null,
      status: "unanswered",
      confidence: 1,
      reasoning: "No answer block on the sheet was matched to this question.",
    }));

  const unmatched: Mapping[] = answers
    .filter((a) => !claimedAnswers.has(a.id))
    .map((a) => ({
      questionId: null,
      answerId: a.id,
      status: "unmatched_answer",
      confidence: 1,
      reasoning: "This answer did not correspond to any question on the paper.",
    }));

  return [...pairs, ...unanswered, ...unmatched];
}

/**
 * The grading model reports its own totals, and gets them wrong: in testing it
 * returned 35/40 for five questions whose own maxScores summed to 50, having
 * quietly dropped the unanswered question from the denominator — which inflates
 * the percentage a teacher reads. Summing is arithmetic, not judgement, so do
 * it here and keep only the model's per-question scores and prose.
 */
export function reconcileGrading(questions: Question[], grading: GradingSummary): GradingSummary {
  const known = new Set(questions.map((q) => q.id));
  const results = (grading.results ?? []).filter((r) => known.has(r.questionId));

  return {
    ...grading,
    results,
    totalScore: results.reduce((sum, r) => sum + (Number(r.score) || 0), 0),
    maxScore: results.reduce((sum, r) => sum + (Number(r.maxScore) || 0), 0),
  };
}
