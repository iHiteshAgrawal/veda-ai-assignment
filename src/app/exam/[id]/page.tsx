"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import type { ExamSession } from "@/types/exam";

/**
 * Functional placeholder for the question<->answer mapping + highlight view.
 * The Figma reference for this screen hasn't been provided yet, so this is
 * built for correctness of the core mechanic (click a question, see its
 * matched answer highlighted on the answer sheet) rather than final visual
 * polish — restyle once that screen comes in.
 */
export default function ExamResultPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ExamSession | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/exam/${id}`)
      .then((r) => r.json())
      .then(setSession);
  }, [id]);

  if (!session) {
    return (
      <AppShell breadcrumb="Exams">
        <p className="p-8 text-neutral-500">Loading…</p>
      </AppShell>
    );
  }

  const selectedMapping = session.mappings.find((m) => m.questionId === selectedQuestionId);
  const selectedAnswer = selectedMapping?.answerId
    ? session.answers.find((a) => a.id === selectedMapping.answerId)
    : undefined;
  const gradeForSelected = session.grading?.results.find((r) => r.questionId === selectedQuestionId);

  const unmatchedAnswers = session.mappings.filter((m) => m.status === "unmatched_answer");

  return (
    <AppShell breadcrumb="Exams">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[380px_1fr]">
        {/* Questions column */}
        <div className="flex flex-col gap-2 rounded-2xl bg-surface p-4">
          <h2 className="mb-2 text-sm font-semibold text-neutral-500">
            Questions ({session.questions.length})
          </h2>
          {session.questions.map((q) => {
            const mapping = session.mappings.find((m) => m.questionId === q.id);
            const grade = session.grading?.results.find((r) => r.questionId === q.id);
            const selected = q.id === selectedQuestionId;
            return (
              <button
                key={q.id}
                onClick={() => setSelectedQuestionId(q.id)}
                className={`flex flex-col gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
                  selected
                    ? "border-brand-orange bg-brand-orange-soft/40"
                    : "border-transparent bg-surface-muted hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-brand-dark">Q{q.number}</span>
                  <StatusPill status={mapping?.status} />
                </div>
                <p className="line-clamp-2 text-xs text-neutral-500">{q.text}</p>
                {grade && (
                  <span className="text-xs font-medium text-brand-orange">
                    {grade.score}/{grade.maxScore} · {grade.verdict.replace("_", " ")}
                  </span>
                )}
              </button>
            );
          })}

          {unmatchedAnswers.length > 0 && (
            <>
              <h2 className="mt-4 mb-2 text-sm font-semibold text-neutral-500">
                Unmatched answers ({unmatchedAnswers.length})
              </h2>
              {unmatchedAnswers.map((m) => {
                const answer = session.answers.find((a) => a.id === m.answerId);
                if (!answer) return null;
                return (
                  <div key={m.answerId} className="rounded-xl bg-surface-muted px-4 py-3">
                    <p className="text-xs text-neutral-500">
                      {answer.declaredLabel ? `Labelled "${answer.declaredLabel}"` : "No label found"} — doesn&apos;t
                      match any question on this paper
                    </p>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Answer sheet column */}
        <div className="flex flex-col gap-4 rounded-2xl bg-surface p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-500">Answer sheet</h2>
            {session.grading && (
              <span className="text-sm font-semibold text-brand-dark">
                Total: {session.grading.totalScore}/{session.grading.maxScore}
              </span>
            )}
          </div>

          {selectedQuestionId && !selectedAnswer && (
            <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-neutral-500">
              This question was left unanswered.
            </p>
          )}

          {gradeForSelected && (
            <p className="rounded-xl bg-brand-orange-soft/40 px-4 py-3 text-sm text-brand-dark">
              {gradeForSelected.feedback}
            </p>
          )}

          <div className="flex flex-col gap-4">
            {session.answerSheetPages.map((page) => (
              <div key={page.pageIndex} className="relative w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.dataUrl} alt={`Answer sheet page ${page.pageIndex + 1}`} className="w-full rounded-lg" />
                {selectedAnswer?.boxes
                  .filter((box) => box.page === page.pageIndex)
                  .map((box, i) => (
                    <div
                      key={i}
                      className="absolute rounded-md border-2 border-brand-orange bg-brand-orange/20"
                      style={{
                        top: `${box.yMin / 10}%`,
                        left: `${box.xMin / 10}%`,
                        width: `${(box.xMax - box.xMin) / 10}%`,
                        height: `${(box.yMax - box.yMin) / 10}%`,
                      }}
                    />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function StatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const styles: Record<string, string> = {
    answered: "bg-green-100 text-green-700",
    unanswered: "bg-neutral-200 text-neutral-500",
    unmatched_answer: "bg-yellow-100 text-yellow-700",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${styles[status] ?? ""}`}>
      {status.replace("_", " ")}
    </span>
  );
}
