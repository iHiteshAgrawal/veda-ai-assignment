"use client";

import { get } from "idb-keyval";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AnswerSheetPanel } from "@/components/AnswerSheetPanel";
import { QuestionCard } from "@/components/QuestionCard";
import type { ExamSession } from "@/types/exam";

export default function ExamResultPage() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<ExamSession | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"questions" | "answers">("questions");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  useEffect(() => {
    // Results live in this browser's IndexedDB, not on the server — see the
    // comment in page.tsx's handleStartMapping for why.
    get<ExamSession>(id).then((data) => {
      if (!data) {
        setNotFound(true);
        return;
      }
      setSession(data);
      setSelectedQuestionId(data.questions[0]?.id ?? null);
    });
  }, [id]);

  const selectedMapping = session?.mappings.find((m) => m.questionId === selectedQuestionId);
  const selectedAnswer =
    session && selectedMapping?.answerId
      ? session.answers.find((a) => a.id === selectedMapping.answerId)
      : undefined;
  const selectedQuestion = session?.questions.find((q) => q.id === selectedQuestionId);

  const unmatchedAnswers = useMemo(
    () => session?.mappings.filter((m) => m.status === "unmatched_answer") ?? [],
    [session]
  );

  const allExpanded = session ? session.questions.every((q) => expandedIds.has(q.id)) : false;

  function selectQuestion(questionId: string) {
    setSelectedQuestionId(questionId);
    const mapping = session?.mappings.find((m) => m.questionId === questionId);
    const answer = mapping?.answerId ? session?.answers.find((a) => a.id === mapping.answerId) : undefined;
    if (answer?.boxes.length) setCurrentPageIndex(answer.boxes[0].page);
    setActiveTab("answers");
  }

  function toggleExpand(questionId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  function toggleExpandAll() {
    if (!session) return;
    setExpandedIds(allExpanded ? new Set() : new Set(session.questions.map((q) => q.id)));
  }

  if (notFound) {
    return (
      <AppShell breadcrumb="Exams" defaultCollapsed>
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl bg-surface p-8 text-center">
          <p className="font-semibold text-brand-dark">No results found for this link</p>
          <p className="text-sm text-neutral-500">
            Results are stored in this browser only. This can happen if you opened the link in a
            different browser, cleared site data, or the upload never finished.
          </p>
          <Link href="/" className="text-sm font-medium text-brand-orange hover:underline">
            Upload a question paper &amp; answer sheet
          </Link>
        </div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell breadcrumb="Exams" defaultCollapsed>
        <p className="p-8 text-neutral-500">Loading…</p>
      </AppShell>
    );
  }

  const questionsPanel = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-brand-dark">Extracted Questions (from question paper)</h2>
        <button onClick={toggleExpandAll} className="text-sm font-medium text-brand-dark hover:underline">
          {allExpanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {session.questions.map((q) => (
        <QuestionCard
          key={q.id}
          question={q}
          mapping={session.mappings.find((m) => m.questionId === q.id)}
          grade={session.grading?.results.find((r) => r.questionId === q.id)}
          selected={q.id === selectedQuestionId}
          expanded={expandedIds.has(q.id)}
          onSelect={() => selectQuestion(q.id)}
          onToggleExpand={() => toggleExpand(q.id)}
        />
      ))}

      {unmatchedAnswers.length > 0 && (
        <>
          <h2 className="mt-2 px-1 text-sm font-semibold text-brand-dark">
            Unmatched answers ({unmatchedAnswers.length})
          </h2>
          {unmatchedAnswers.map((m) => {
            const answer = session.answers.find((a) => a.id === m.answerId);
            if (!answer) return null;
            return (
              <div key={m.answerId} className="rounded-2xl bg-surface p-4">
                <p className="text-sm text-neutral-500">
                  {answer.declaredLabel ? `Labelled "${answer.declaredLabel}"` : "No label found"} — doesn&apos;t
                  match any question on this paper.
                </p>
                <p className="mt-2 text-xs text-neutral-400 italic">&quot;{answer.transcript}&quot;</p>
              </div>
            );
          })}
        </>
      )}
    </div>
  );

  const answersPanel = (
    <AnswerSheetPanel
      pages={session.answerSheetPages}
      currentPageIndex={currentPageIndex}
      onPageChange={setCurrentPageIndex}
      highlightBoxes={selectedAnswer?.boxes ?? []}
      highlightLabel={selectedQuestion ? selectedQuestion.number : null}
    />
  );

  return (
    <AppShell breadcrumb="Exams" defaultCollapsed>
      {session.grading && (
        <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
          <span className="text-sm font-semibold text-brand-dark">Grading summary</span>
          <span className="text-sm font-semibold text-brand-dark">
            Total: {session.grading.totalScore}/{session.grading.maxScore}
          </span>
        </div>
      )}

      {/* Mobile tab switcher */}
      <div className="mb-4 flex rounded-full bg-surface-muted p-1 lg:hidden">
        {(["questions", "answers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-full py-2 text-sm font-semibold capitalize transition-colors ${
              activeTab === tab ? "bg-brand-dark text-white" : "text-neutral-500"
            }`}
          >
            {tab === "questions" ? "Questions" : "Answer Sheet"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className={activeTab === "questions" ? "block" : "hidden lg:block"}>{questionsPanel}</div>
        <div
          className={`lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)] ${
            activeTab === "answers" ? "block" : "hidden lg:block"
          }`}
        >
          {answersPanel}
        </div>
      </div>
    </AppShell>
  );
}
