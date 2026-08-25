import { describe, expect, it } from "vitest";
import { mergeGradingBatches, reconcileGrading, reconcileMappings } from "./reconcile";
import type { AnswerBlock, GradingSummary, Mapping, Question } from "@/types/exam";

const q = (id: string, number: string): Question => ({
  id,
  number,
  parentNumber: null,
  text: `question ${number}`,
  box: null,
});

const a = (id: string): AnswerBlock => ({
  id,
  transcript: `answer ${id}`,
  declaredLabel: null,
  boxes: [],
});

const pair = (questionId: string | null, answerId: string | null, status: Mapping["status"]): Mapping => ({
  questionId,
  answerId,
  status,
  confidence: 1,
  reasoning: "",
});

describe("reconcileMappings", () => {
  const questions = [q("q1", "Q1"), q("q2", "Q2")];
  const answers = [a("a1"), a("a2")];

  it("keeps clean pairings and derives the rest", () => {
    const result = reconcileMappings(questions, answers, [pair("q1", "a1", "answered")]);
    expect(result).toEqual([
      expect.objectContaining({ questionId: "q1", answerId: "a1", status: "answered" }),
      expect.objectContaining({ questionId: "q2", answerId: null, status: "unanswered" }),
      expect.objectContaining({ questionId: null, answerId: "a2", status: "unmatched_answer" }),
    ]);
  });

  it("discards a row whose status contradicts its ids", () => {
    // The bug that scored a correct answer 0/10: a question paired to an answer
    // while simultaneously tagged unmatched_answer, orphaning the real answer.
    const result = reconcileMappings(questions, answers, [
      pair("q1", "a2", "unmatched_answer"),
      pair(null, "a1", "unmatched_answer"),
    ]);
    // Neither row is a valid pairing, so both questions end up unanswered and
    // both answers unmatched — rather than a silently wrong pairing.
    expect(result.filter((m) => m.status === "answered")).toHaveLength(0);
    expect(result.filter((m) => m.status === "unanswered")).toHaveLength(2);
    expect(result.filter((m) => m.status === "unmatched_answer")).toHaveLength(2);
  });

  it("refuses to let two questions claim the same answer", () => {
    const result = reconcileMappings(questions, answers, [
      pair("q1", "a1", "answered"),
      pair("q2", "a1", "answered"),
    ]);
    expect(result.filter((m) => m.status === "answered")).toHaveLength(1);
    expect(result).toContainEqual(expect.objectContaining({ questionId: "q2", status: "unanswered" }));
  });

  it("ignores ids that don't exist", () => {
    const result = reconcileMappings(questions, answers, [pair("nope", "a1", "answered")]);
    expect(result.filter((m) => m.status === "answered")).toHaveLength(0);
  });

  it("always covers every question exactly once and every answer at most once", () => {
    const result = reconcileMappings(questions, answers, []);
    const questionIds = result.filter((m) => m.questionId).map((m) => m.questionId);
    expect(new Set(questionIds).size).toBe(questions.length);
  });

  it("survives a non-array response", () => {
    expect(() => reconcileMappings(questions, answers, undefined as never)).not.toThrow();
  });
});

describe("reconcileGrading", () => {
  const questions = [q("q1", "Q1"), q("q2", "Q2")];

  const summary = (overrides: Partial<GradingSummary>): GradingSummary => ({
    totalScore: 0,
    maxScore: 0,
    overallFeedback: "",
    results: [],
    ...overrides,
  });

  it("recomputes totals rather than trusting the model's arithmetic", () => {
    // Observed: the model reported 35/40 for questions whose own maxScores summed to 50.
    const result = reconcileGrading(
      questions,
      summary({
        totalScore: 35,
        maxScore: 40,
        results: [
          { questionId: "q1", verdict: "correct", score: 10, maxScore: 10, feedback: "" },
          { questionId: "q2", verdict: "ungraded", score: 0, maxScore: 10, feedback: "" },
        ],
      })
    );
    expect(result.totalScore).toBe(10);
    expect(result.maxScore).toBe(20);
  });

  it("drops results for questions that don't exist", () => {
    const result = reconcileGrading(
      questions,
      summary({
        results: [{ questionId: "ghost", verdict: "correct", score: 10, maxScore: 10, feedback: "" }],
      })
    );
    expect(result.results).toHaveLength(0);
    expect(result.maxScore).toBe(0);
  });
});

describe("mergeGradingBatches", () => {
  it("concatenates results and leaves totals for reconcileGrading", () => {
    const merged = mergeGradingBatches([
      {
        totalScore: 10,
        maxScore: 10,
        overallFeedback: "First half solid.",
        results: [{ questionId: "q1", verdict: "correct", score: 10, maxScore: 10, feedback: "" }],
      },
      {
        totalScore: 0,
        maxScore: 10,
        overallFeedback: "Second half weaker.",
        results: [{ questionId: "q2", verdict: "incorrect", score: 0, maxScore: 10, feedback: "" }],
      },
    ]);
    expect(merged.results).toHaveLength(2);
    expect(merged.overallFeedback).toBe("First half solid. Second half weaker.");
    expect(merged.totalScore).toBe(0); // deliberately deferred
  });
});
