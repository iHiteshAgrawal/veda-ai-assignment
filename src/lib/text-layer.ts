/**
 * Client-side only. Extracts a *measured* line index from a PDF's embedded text
 * layer.
 *
 * This is the deterministic half of the pipeline. A digital PDF already knows
 * exactly where every glyph sits, so there is nothing for a model to estimate:
 * the coordinates here are read, not generated. Downstream, the model is handed
 * these lines as text and asked which line IDs form each question — it selects
 * from measured regions instead of inventing rectangles, which makes a
 * hallucinated coordinate structurally impossible.
 *
 * Scanned PDFs and photographs have no text layer; those fall back to the
 * vision path.
 */
import type { IndexedLine, LineIndex, NormalizedBox } from "@/types/exam";
import { getPdfjs, isPdf } from "./pdfjs";

/** Two glyph runs belong to the same visual line if their baselines differ by less than this fraction of page height. */
const LINE_MERGE_TOLERANCE = 0.006;

/**
 * Below this many characters per page we treat the text layer as absent.
 * Scanned PDFs frequently carry a handful of stray glyphs (a header stamp, a
 * watermark) that would otherwise look like a usable layer and produce a line
 * index covering almost none of the actual content.
 */
const MIN_CHARS_PER_PAGE = 80;

interface PositionedRun {
  text: string;
  x: number;
  y: number; // top edge, device space
  width: number;
  height: number;
}

function toNormalizedBox(
  page: number,
  runs: PositionedRun[],
  pageWidth: number,
  pageHeight: number
): NormalizedBox {
  const xMin = Math.min(...runs.map((r) => r.x));
  const xMax = Math.max(...runs.map((r) => r.x + r.width));
  const yMin = Math.min(...runs.map((r) => r.y));
  const yMax = Math.max(...runs.map((r) => r.y + r.height));

  const scale = (value: number, extent: number) =>
    Math.max(0, Math.min(1000, Math.round((value / extent) * 1000)));

  return {
    page,
    xMin: scale(xMin, pageWidth),
    xMax: scale(xMax, pageWidth),
    yMin: scale(yMin, pageHeight),
    yMax: scale(yMax, pageHeight),
  };
}

/** Groups glyph runs sharing a baseline into single lines, in reading order. */
function groupIntoLines(
  runs: PositionedRun[],
  pageIndex: number,
  pageWidth: number,
  pageHeight: number,
  startId: number
): IndexedLine[] {
  if (runs.length === 0) return [];

  const tolerance = pageHeight * LINE_MERGE_TOLERANCE;
  const sorted = [...runs].sort((a, b) => a.y - b.y || a.x - b.x);

  const groups: PositionedRun[][] = [];
  let current: PositionedRun[] = [sorted[0]];

  for (const run of sorted.slice(1)) {
    const reference = current[current.length - 1];
    if (Math.abs(run.y - reference.y) <= tolerance) {
      current.push(run);
    } else {
      groups.push(current);
      current = [run];
    }
  }
  groups.push(current);

  return groups
    .map((group, offset) => {
      const ordered = [...group].sort((a, b) => a.x - b.x);
      const text = ordered
        .map((r) => r.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      return {
        id: startId + offset,
        text,
        box: toNormalizedBox(pageIndex, ordered, pageWidth, pageHeight),
      };
    })
    .filter((line) => line.text.length > 0);
}

/**
 * Returns a measured line index, or null when the document has no usable text
 * layer (a scan, a photo, or a PDF of page images).
 */
export async function extractLineIndex(file: File): Promise<LineIndex | null> {
  if (!isPdf(file)) return null;

  const pdfjs = await getPdfjs();
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buffer }).promise;

  const lines: IndexedLine[] = [];
  let totalChars = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const runs: PositionedRun[] = [];
    for (const item of content.items) {
      if (!("str" in item) || item.str.trim().length === 0) continue;

      // viewport.transform maps PDF user space (origin bottom-left) into device
      // space (origin top-left) and folds in any page rotation.
      const t = pdfjs.Util.transform(viewport.transform, item.transform);
      const height = Math.hypot(t[1], t[3]) || item.height;
      runs.push({
        text: item.str,
        x: t[4],
        y: t[5] - height, // t[5] is the baseline; shift up to the top edge
        width: item.width,
        height,
      });
      totalChars += item.str.trim().length;
    }

    lines.push(
      ...groupIntoLines(runs, pageNumber - 1, viewport.width, viewport.height, lines.length)
    );
  }

  if (totalChars < MIN_CHARS_PER_PAGE * pdf.numPages) return null;
  return { lines, pageCount: pdf.numPages };
}

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
