import { ChevronDown, ChevronUp } from "lucide-react";
import type { GradingResult, Mapping, Question } from "@/types/exam";
import { ScorePill } from "./ScorePill";

/** "11(a)" with parentNumber "11" -> { badgeNumber: "11", subLabel: "a." } */
function splitNumber(question: Question): { badgeNumber: string; subLabel: string | null } {
  if (!question.parentNumber) return { badgeNumber: question.number, subLabel: null };
  const rest = question.number
    .slice(question.parentNumber.length)
    .replace(/[().]/g, "")
    .trim();
  return { badgeNumber: question.parentNumber, subLabel: rest ? `${rest}.` : null };
}

export function QuestionCard({
  question,
  mapping,
  grade,
  selected,
  expanded,
  onSelect,
  onToggleExpand,
}: {
  question: Question;
  mapping: Mapping | undefined;
  grade: GradingResult | undefined;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
  onToggleExpand: () => void;
}) {
  const { badgeNumber, subLabel } = splitNumber(question);

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        // Selecting a question is the core interaction of this screen, so it
        // has to work from the keyboard, not just the mouse.
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer rounded-2xl bg-surface p-4 transition-shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange ${
        selected ? "ring-2 ring-brand-orange" : "hover:shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
              selected ? "bg-brand-orange" : "bg-badge-neutral"
            }`}
          >
            {badgeNumber}
          </span>
          {subLabel && <span className="pt-1 text-sm text-neutral-400">{subLabel}</span>}
          <p className="min-w-0 pt-1 text-sm text-neutral-600">{question.text}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ScorePill mapping={mapping} score={grade?.score} maxScore={grade?.maxScore} />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-neutral-400 hover:text-brand-dark"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && grade && (
        <div className="mt-3 rounded-xl bg-surface-muted p-4">
          <p className="mb-1 text-sm font-semibold text-brand-dark">AI Feedback</p>
          <p className="text-sm text-neutral-500">{grade.feedback}</p>
        </div>
      )}
    </div>
  );
}
