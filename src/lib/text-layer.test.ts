import { describe, expect, it } from "vitest";
import { boxesForLineIds } from "./text-layer";
import type { LineIndex } from "@/types/exam";

const index: LineIndex = {
  pageCount: 2,
  lines: [
    { id: 0, text: "Q1. What is the capital of France?", box: { page: 0, yMin: 100, yMax: 120, xMin: 60, xMax: 500 } },
    { id: 1, text: "Q2. Explain photosynthesis in two", box: { page: 0, yMin: 140, yMax: 160, xMin: 60, xMax: 620 } },
    { id: 2, text: "sentences.", box: { page: 0, yMin: 162, yMax: 182, xMin: 60, xMax: 240 } },
    { id: 3, text: "Q3. Continued overleaf.", box: { page: 1, yMin: 40, yMax: 60, xMin: 60, xMax: 400 } },
  ],
};

describe("boxesForLineIds", () => {
  it("unions the measured boxes of the selected lines", () => {
    // A wrapped question: two lines become one region covering both.
    expect(boxesForLineIds(index, [1, 2])).toEqual([
      { page: 0, yMin: 140, yMax: 182, xMin: 60, xMax: 620 },
    ]);
  });

  it("returns one box per page for a selection spanning pages", () => {
    const boxes = boxesForLineIds(index, [0, 3]);
    expect(boxes).toHaveLength(2);
    expect(boxes.map((b) => b.page)).toEqual([0, 1]);
  });

  it("skips ids the model invented instead of guessing geometry", () => {
    expect(boxesForLineIds(index, [0, 999])).toEqual([
      { page: 0, yMin: 100, yMax: 120, xMin: 60, xMax: 500 },
    ]);
  });

  it("returns nothing when no id resolves, so no phantom highlight renders", () => {
    expect(boxesForLineIds(index, [42, 43])).toEqual([]);
  });

  it("handles an empty selection", () => {
    expect(boxesForLineIds(index, [])).toEqual([]);
  });
});
