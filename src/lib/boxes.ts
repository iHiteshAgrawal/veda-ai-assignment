import type { NormalizedBox } from "@/types/exam";

/**
 * Model-returned bounding boxes need cleaning before they can drive CSS.
 * Two real failure modes seen in testing:
 *
 *  1. Incomplete boxes — some models omit a coordinate despite the response
 *     schema marking it required (gemini-flash-lite-latest dropped `yMin` on
 *     5 of 6 boxes). Undefined coordinates become `NaN%` in CSS, which the
 *     browser discards, so the box silently loses its positioning.
 *  2. Over-segmentation — one answer's consecutive handwritten lines come back
 *     as several stacked boxes, which renders as a stack of separate
 *     rectangles instead of one highlight over the whole answer.
 */

const AXIS_MAX = 1000;

/** Consecutive lines of one answer sit a few units apart; genuinely separate regions sit much further. */
const MAX_VERTICAL_GAP = 30;

function isValid(box: unknown): box is NormalizedBox {
  if (!box || typeof box !== "object") return false;
  const b = box as Record<string, unknown>;
  const coords = ["page", "yMin", "xMin", "yMax", "xMax"];
  if (!coords.every((k) => typeof b[k] === "number" && Number.isFinite(b[k] as number))) return false;
  return (b.page as number) >= 0;
}

function clamp(value: number): number {
  return Math.min(AXIS_MAX, Math.max(0, value));
}

/** Drops unusable boxes, clamps to the 0-1000 axis, and repairs inverted min/max pairs. */
export function sanitizeBoxes(boxes: unknown): NormalizedBox[] {
  if (!Array.isArray(boxes)) return [];

  return boxes.filter(isValid).flatMap((box) => {
    const yMin = clamp(Math.min(box.yMin, box.yMax));
    const yMax = clamp(Math.max(box.yMin, box.yMax));
    const xMin = clamp(Math.min(box.xMin, box.xMax));
    const xMax = clamp(Math.max(box.xMin, box.xMax));
    // A zero-area box would render as an invisible sliver — no use as a highlight.
    if (yMax - yMin <= 0 || xMax - xMin <= 0) return [];
    return [{ page: Math.trunc(box.page), yMin, yMax, xMin, xMax }];
  });
}

function horizontallyOverlap(a: NormalizedBox, b: NormalizedBox): boolean {
  return a.xMin <= b.xMax && b.xMin <= a.xMax;
}

/**
 * Unions boxes that are stacked lines of the same answer. Requires horizontal
 * overlap as well as vertical adjacency so a two-column layout doesn't collapse
 * into one box spanning both columns. Boxes on different pages never merge —
 * a genuinely multi-page answer keeps one box per page.
 */
export function mergeAdjacentBoxes(boxes: NormalizedBox[]): NormalizedBox[] {
  const byPage = new Map<number, NormalizedBox[]>();
  for (const box of boxes) {
    const pageBoxes = byPage.get(box.page) ?? [];
    pageBoxes.push(box);
    byPage.set(box.page, pageBoxes);
  }

  const merged: NormalizedBox[] = [];
  for (const [page, pageBoxes] of byPage) {
    const sorted = [...pageBoxes].sort((a, b) => a.yMin - b.yMin);
    let current = sorted[0];

    for (const box of sorted.slice(1)) {
      const gap = box.yMin - current.yMax;
      if (gap <= MAX_VERTICAL_GAP && horizontallyOverlap(current, box)) {
        current = {
          page,
          yMin: Math.min(current.yMin, box.yMin),
          yMax: Math.max(current.yMax, box.yMax),
          xMin: Math.min(current.xMin, box.xMin),
          xMax: Math.max(current.xMax, box.xMax),
        };
      } else {
        merged.push(current);
        current = box;
      }
    }
    merged.push(current);
  }

  return merged;
}

/** Full clean-up pass applied to every answer's boxes as they come back from a provider. */
export function normalizeAnswerBoxes(boxes: unknown): NormalizedBox[] {
  return mergeAdjacentBoxes(sanitizeBoxes(boxes));
}
