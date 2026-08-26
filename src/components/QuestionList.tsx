import type { ExamSession } from "@/types/exam";
import { QuestionCard } from "./QuestionCard";
import { UnmatchedAnswers } from "./UnmatchedAnswers";

export function QuestionList({
  session,
  selectedQuestionId,
  expandedIds,
  allExpanded,
  onSelect,
  onToggleExpand,
  onToggleExpandAll,
}: {
  session: ExamSession;
  selectedQuestionId: string | null;
  expandedIds: ReadonlySet<string>;
  allExpanded: boolean;
  onSelect: (questionId: string) => void;
  onToggleExpand: (questionId: string) => void;
  onToggleExpandAll: () => void;
}) {
  const unmatched = session.mappings.filter((m) => m.status === "unmatched_answer");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-brand-dark">
          Extracted Questions (from question paper)
        </h2>
        <button
          onClick={onToggleExpandAll}
          className="rounded text-sm font-medium text-brand-dark hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </button>
      </div>

      {session.questions.map((question) => (
        <QuestionCard
          key={question.id}
          question={question}
          mapping={session.mappings.find((m) => m.questionId === question.id)}
          grade={session.grading?.results.find((r) => r.questionId === question.id)}
          selected={question.id === selectedQuestionId}
          expanded={expandedIds.has(question.id)}
          onSelect={() => onSelect(question.id)}
          onToggleExpand={() => onToggleExpand(question.id)}
        />
      ))}

      <UnmatchedAnswers session={session} mappings={unmatched} />
    </div>
  );
}
