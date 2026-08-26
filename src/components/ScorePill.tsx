import type { Mapping } from "@/types/exam";
import { Pill, type PillTone } from "./ui/Pill";

/** Full marks reads as success, zero as danger, anything between as partial. */
function toneForScore(score: number, maxScore: number): PillTone {
  if (score >= maxScore) return "success";
  if (score <= 0) return "danger";
  return "warning";
}

export function ScorePill({
  mapping,
  score,
  maxScore,
}: {
  mapping: Mapping | undefined;
  score?: number;
  maxScore?: number;
}) {
  if (mapping?.status === "unanswered") return <Pill>Not answered</Pill>;
  if (score === undefined || maxScore === undefined) return <Pill>Ungraded</Pill>;

  return (
    <Pill tone={toneForScore(score, maxScore)}>
      {score}/{maxScore}
    </Pill>
  );
}
