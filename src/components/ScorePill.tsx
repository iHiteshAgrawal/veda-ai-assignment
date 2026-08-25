import type { Mapping } from "@/types/exam";

export function ScorePill({
  mapping,
  score,
  maxScore,
}: {
  mapping: Mapping | undefined;
  score?: number;
  maxScore?: number;
}) {
  if (mapping?.status === "unanswered") {
    return (
      <span className="whitespace-nowrap rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-neutral-400">
        Not answered
      </span>
    );
  }

  if (score === undefined || maxScore === undefined) {
    return (
      <span className="whitespace-nowrap rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-neutral-400">
        Ungraded
      </span>
    );
  }

  const tone = score === maxScore ? "success" : score === 0 ? "danger" : "warning";
  const styles = {
    success: "bg-success-soft text-success",
    danger: "bg-danger-soft text-danger",
    warning: "bg-warning-soft text-warning",
  } as const;

  return (
    <span className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${styles[tone]}`}>
      {score}/{maxScore}
    </span>
  );
}
