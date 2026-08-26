"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { AnswerSheetPanel } from "@/components/AnswerSheetPanel";
import { AppShell } from "@/components/AppShell";
import { QuestionList } from "@/components/QuestionList";
import { Pill } from "@/components/ui/Pill";
import { useExamSession } from "@/hooks/useExamSession";
import { useQuestionSelection } from "@/hooks/useQuestionSelection";
import type { ExamSession } from "@/types/exam";

/** Explains why the answer sheet has no highlight, rather than showing nothing. */
function highlightNoticeFor(selection: ReturnType<typeof useQuestionSelection>): string | null {
  const { selectedQuestion, selectedMapping, selectedAnswer } = selection;
  if (!selectedQuestion) return null;
  if (selectedMapping?.status === "unanswered") {
    return `${selectedQuestion.number} was left unanswered — nothing to highlight.`;
  }
  if (selectedAnswer && selectedAnswer.boxes.length === 0) {
    return `Found the answer to ${selectedQuestion.number}, but couldn't locate it on the sheet.`;
  }
  return null;
}

function GradingSummaryBar({ session }: { session: ExamSession }) {
  if (!session.grading) return null;
  return (
    <div className="mb-4 flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
      <span className="text-sm font-semibold text-brand-dark">Grading summary</span>
      <div className="flex items-center gap-3">
        {session.answerGeometry === "measured" && <Pill tone="success">OCR-measured highlights</Pill>}
        <span className="text-sm font-semibold text-brand-dark">
          Total: {session.grading.totalScore}/{session.grading.maxScore}
        </span>
      </div>
    </div>
  );
}

function NotFound() {
  return (
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
  );
}

export default function ExamResultPage() {
  const { id } = useParams<{ id: string }>();
  const { status, session } = useExamSession(id);
  const selection = useQuestionSelection(session);
  const [activeTab, setActiveTab] = useState<"questions" | "answers">("questions");

  if (status === "not-found") {
    return (
      <AppShell breadcrumb="Exams" defaultCollapsed>
        <NotFound />
      </AppShell>
    );
  }

  if (status === "loading") {
    return (
      <AppShell breadcrumb="Exams" defaultCollapsed>
        <p className="p-8 text-neutral-500">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Exams" defaultCollapsed>
      <GradingSummaryBar session={session} />

      {/* Mobile only: the desktop layout shows both panels side by side. */}
      <div className="mb-4 flex rounded-full bg-surface-muted p-1 lg:hidden">
        {(["questions", "answers"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            aria-pressed={activeTab === tab}
            className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange ${
              activeTab === tab ? "bg-brand-dark text-white" : "text-neutral-500"
            }`}
          >
            {tab === "questions" ? "Questions" : "Answer Sheet"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className={activeTab === "questions" ? "block" : "hidden lg:block"}>
          <QuestionList
            session={session}
            selectedQuestionId={selection.selectedQuestionId}
            expandedIds={selection.expandedIds}
            allExpanded={selection.allExpanded}
            onSelect={(questionId) => {
              selection.selectQuestion(questionId);
              setActiveTab("answers");
            }}
            onToggleExpand={selection.toggleExpand}
            onToggleExpandAll={selection.toggleExpandAll}
          />
        </div>

        <div
          className={`lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)] ${
            activeTab === "answers" ? "block" : "hidden lg:block"
          }`}
        >
          <AnswerSheetPanel
            pages={session.answerSheetPages}
            currentPageIndex={selection.currentPageIndex}
            onPageChange={selection.setCurrentPageIndex}
            highlightBoxes={selection.selectedAnswer?.boxes ?? []}
            highlightLabel={selection.selectedQuestion?.number ?? null}
            notice={highlightNoticeFor(selection)}
          />
        </div>
      </div>
    </AppShell>
  );
}
