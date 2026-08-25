import { describe, expect, it } from "vitest";
import { mergeAdjacentBoxes, normalizeAnswerBoxes, sanitizeBoxes } from "./boxes";

const box = (page: number, yMin: number, yMax: number, xMin = 100, xMax = 800) => ({
  page,
  yMin,
  yMax,
  xMin,
  xMax,
});

describe("sanitizeBoxes", () => {
  it("drops boxes missing a coordinate", () => {
    // The real failure: gemini-flash-lite-latest omitted yMin, which reached
    // the DOM as `top: NaN%` and silently lost the box's positioning.
    expect(sanitizeBoxes([{ page: 0, xMin: 209, xMax: 836, yMax: 151 }])).toEqual([]);
  });

  it("drops non-finite coordinates", () => {
    expect(sanitizeBoxes([box(0, NaN, 100)])).toEqual([]);
    expect(sanitizeBoxes([box(0, 0, Infinity)])).toEqual([]);
  });

  it("keeps well-formed boxes", () => {
    expect(sanitizeBoxes([box(0, 72, 117, 52, 846)])).toEqual([
      { page: 0, yMin: 72, yMax: 117, xMin: 52, xMax: 846 },
    ]);
  });

  it("repairs inverted min/max pairs", () => {
    expect(sanitizeBoxes([{ page: 0, yMin: 300, yMax: 100, xMin: 900, xMax: 200 }])).toEqual([
      { page: 0, yMin: 100, yMax: 300, xMin: 200, xMax: 900 },
    ]);
  });

  it("clamps out-of-range values to the 0-1000 axis", () => {
    expect(sanitizeBoxes([{ page: 0, yMin: -50, yMax: 4000, xMin: -10, xMax: 1200 }])).toEqual([
      { page: 0, yMin: 0, yMax: 1000, xMin: 0, xMax: 1000 },
    ]);
  });

  it("drops zero-area boxes that would render as an invisible sliver", () => {
    expect(sanitizeBoxes([box(0, 100, 100)])).toEqual([]);
  });

  it("tolerates a non-array input", () => {
    expect(sanitizeBoxes(undefined)).toEqual([]);
    expect(sanitizeBoxes({ page: 0 })).toEqual([]);
  });
});

describe("mergeAdjacentBoxes", () => {
  it("merges stacked lines of one answer into a single highlight", () => {
    // Observed on every model tested: one answer, two consecutive line-groups.
    const merged = mergeAdjacentBoxes([box(0, 70, 140, 208, 840), box(0, 142, 172, 231, 595)]);
    expect(merged).toEqual([{ page: 0, yMin: 70, yMax: 172, xMin: 208, xMax: 840 }]);
  });

  it("keeps regions far apart separate", () => {
    const merged = mergeAdjacentBoxes([box(0, 70, 140), box(0, 600, 660)]);
    expect(merged).toHaveLength(2);
  });

  it("never merges across pages, so multi-page answers keep one box per page", () => {
    const merged = mergeAdjacentBoxes([box(0, 900, 980), box(1, 20, 90)]);
    expect(merged).toHaveLength(2);
    expect(merged.map((b) => b.page)).toEqual([0, 1]);
  });

  it("does not merge vertically-close boxes in separate columns", () => {
    const left = box(0, 100, 130, 40, 300);
    const right = box(0, 132, 160, 600, 900);
    expect(mergeAdjacentBoxes([left, right])).toHaveLength(2);
  });
});

describe("normalizeAnswerBoxes", () => {
  it("sanitizes before merging so a malformed box cannot widen a good one", () => {
    const result = normalizeAnswerBoxes([
      box(0, 72, 117, 52, 846),
      { page: 0, xMin: 209, xMax: 836, yMax: 151 }, // missing yMin
    ]);
    expect(result).toEqual([{ page: 0, yMin: 72, yMax: 117, xMin: 52, xMax: 846 }]);
  });
});
