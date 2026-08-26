import type { ReactNode } from "react";

/**
 * The one repeated shape in this UI: score pills, the "Not answered" chip, and
 * the geometry-provenance badge are the same capsule in different tones.
 *
 * Tones are semantic rather than colour-named ("success", not "green") so the
 * palette can change without every call site lying about what it means.
 */
export type PillTone = "success" | "warning" | "danger" | "neutral";

const TONE_STYLES: Record<PillTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-surface-muted text-neutral-400",
};

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONE_STYLES[tone]}`}
    >
      {children}
    </span>
  );
}
