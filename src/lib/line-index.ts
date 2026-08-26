/**
 * Pure helpers over a measured line index. Kept free of any pdf.js or network
 * imports so both the browser (PDF text layer) and the server (Vision OCR) can
 * build one and share the same geometry maths.
 */
import type { IndexedLine, LineIndex, NormalizedBox } from "@/types/exam";

/** Union of the boxes for the given line IDs, one box per page the lines span. */
export function boxesForLineIds(index: LineIndex, lineIds: readonly number[]): NormalizedBox[] {
  const byId = new Map(index.lines.map((line) => [line.id, line]));
  const byPage = new Map<number, NormalizedBox>();

  for (const id of lineIds) {
    const line = byId.get(id);
    if (!line) continue; // model named a line that doesn't exist — skip rather than guess
    const existing = byPage.get(line.box.page);
    byPage.set(
      line.box.page,
      existing
        ? {
            page: line.box.page,
            xMin: Math.min(existing.xMin, line.box.xMin),
            xMax: Math.max(existing.xMax, line.box.xMax),
            yMin: Math.min(existing.yMin, line.box.yMin),
            yMax: Math.max(existing.yMax, line.box.yMax),
          }
        : line.box
    );
  }

  return [...byPage.values()].sort((a, b) => a.page - b.page);
}

/** Renders the index for a prompt: one `id: text` per line, grouped by page. */
export function formatLineIndex(lines: readonly IndexedLine[]): string {
  const byPage = new Map<number, IndexedLine[]>();
  for (const line of lines) {
    const group = byPage.get(line.box.page) ?? [];
    group.push(line);
    byPage.set(line.box.page, group);
  }

  return [...byPage.entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, group]) =>
      [`Page ${page}:`, ...group.map((l) => `${l.id}: ${l.text}`)].join("\n")
    )
    .join("\n\n");
}
