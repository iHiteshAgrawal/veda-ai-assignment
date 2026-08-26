/**
 * Server-side only. Google Cloud Vision `DOCUMENT_TEXT_DETECTION` turned into a
 * measured line index.
 *
 * This is the geometry half of the answer-sheet pipeline. Vision *measures*
 * where the ink is — it returns real pixel polygons per word — where a
 * generative model only estimates coordinates. It reads handwriting somewhat
 * worse than Gemini does (on our test sheet Vision produced "1527 42" where
 * Gemini read "15 + 27 = 42"), so the transcript still comes from the vision
 * model; only the coordinates come from here.
 *
 * Optional: with no GOOGLE_VISION_API_KEY set, the pipeline falls back to
 * model-estimated boxes rather than failing.
 */
import type { IndexedLine, LineIndex, SourcePage } from "@/types/exam";
import { mapWithConcurrency, withTimeout } from "./async";

const ENDPOINT = "https://vision.googleapis.com/v1/images:annotate";
const TIMEOUT_MS = 30_000;

/** Vision bills per image; a handful of pages in parallel stays well inside quota. */
const PAGE_CONCURRENCY = 4;

/** Words whose vertical centres sit within this fraction of page height belong to one line. */
const LINE_MERGE_TOLERANCE = 0.008;

export function isVisionConfigured(): boolean {
  return Boolean(process.env.GOOGLE_VISION_API_KEY);
}

interface Vertex {
  x?: number;
  y?: number;
}

interface VisionWord {
  boundingBox?: { vertices?: Vertex[] };
  symbols?: Array<{ text?: string }>;
}

interface VisionResponse {
  responses?: Array<{
    error?: { message?: string };
    fullTextAnnotation?: {
      pages?: Array<{
        width?: number;
        height?: number;
        blocks?: Array<{ paragraphs?: Array<{ words?: VisionWord[] }> }>;
      }>;
    };
  }>;
}

interface PositionedWord {
  text: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  centreY: number;
}

function toBase64(dataUrl: string): string {
  const match = dataUrl.match(/^data:.+;base64,(.+)$/);
  if (!match) throw new Error("Page image is not a base64 data URL");
  return match[1];
}

async function annotatePage(page: SourcePage): Promise<PositionedWord[]> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_VISION_API_KEY is not set");

  const response = await withTimeout(
    fetch(`${ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: toBase64(page.dataUrl) },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["en"] },
          },
        ],
      }),
    }),
    TIMEOUT_MS,
    `Vision OCR (page ${page.pageIndex})`
  );

  if (!response.ok) {
    // Don't echo the URL back — it carries the API key as a query parameter.
    throw new Error(`Vision OCR failed with ${response.status}`);
  }

  const body = (await response.json()) as VisionResponse;
  const result = body.responses?.[0];
  if (result?.error) throw new Error(`Vision OCR: ${result.error.message ?? "unknown error"}`);

  const visionPage = result?.fullTextAnnotation?.pages?.[0];
  if (!visionPage) return [];

  // Vision reports its own page dimensions; prefer them over the caller's, since
  // the polygons are expressed in that coordinate space.
  const width = visionPage.width || page.width;
  const height = visionPage.height || page.height;

  const words: PositionedWord[] = [];
  for (const block of visionPage.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const word of paragraph.words ?? []) {
        const vertices = word.boundingBox?.vertices ?? [];
        if (vertices.length === 0) continue;

        const xs = vertices.map((v) => v.x ?? 0);
        const ys = vertices.map((v) => v.y ?? 0);
        const text = (word.symbols ?? []).map((s) => s.text ?? "").join("");
        if (!text.trim()) continue;

        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        words.push({
          text,
          xMin: (Math.min(...xs) / width) * 1000,
          xMax: (Math.max(...xs) / width) * 1000,
          yMin: (yMin / height) * 1000,
          yMax: (yMax / height) * 1000,
          centreY: ((yMin + yMax) / 2 / height) * 1000,
        });
      }
    }
  }
  return words;
}

/**
 * Groups words into visual lines. Vision's own block/paragraph grouping follows
 * semantic reading order, which on a handwritten sheet detaches question labels
 * from their answers — grouping by vertical position instead keeps a line
 * matching what a person sees on the page.
 */
function groupIntoLines(words: PositionedWord[], pageIndex: number, startId: number): IndexedLine[] {
  if (words.length === 0) return [];

  const sorted = [...words].sort((a, b) => a.centreY - b.centreY || a.xMin - b.xMin);
  const tolerance = 1000 * LINE_MERGE_TOLERANCE;

  const groups: PositionedWord[][] = [];
  let current: PositionedWord[] = [sorted[0]];

  for (const word of sorted.slice(1)) {
    const reference = current[current.length - 1];
    if (Math.abs(word.centreY - reference.centreY) <= tolerance) current.push(word);
    else {
      groups.push(current);
      current = [word];
    }
  }
  groups.push(current);

  return groups
    .map((group, offset) => {
      const ordered = [...group].sort((a, b) => a.xMin - b.xMin);
      const clamp = (v: number) => Math.max(0, Math.min(1000, Math.round(v)));
      return {
        id: startId + offset,
        text: ordered.map((w) => w.text).join(" ").replace(/\s+/g, " ").trim(),
        box: {
          page: pageIndex,
          xMin: clamp(Math.min(...ordered.map((w) => w.xMin))),
          xMax: clamp(Math.max(...ordered.map((w) => w.xMax))),
          yMin: clamp(Math.min(...ordered.map((w) => w.yMin))),
          yMax: clamp(Math.max(...ordered.map((w) => w.yMax))),
        },
      };
    })
    .filter((line) => line.text.length > 0);
}

/** Runs OCR over every page and returns one measured line index, or null if nothing was found. */
export async function buildVisionLineIndex(pages: SourcePage[]): Promise<LineIndex | null> {
  const perPage = await mapWithConcurrency(pages, PAGE_CONCURRENCY, (page) => annotatePage(page));

  const lines: IndexedLine[] = [];
  perPage.forEach((words, index) => {
    lines.push(...groupIntoLines(words, pages[index].pageIndex, lines.length));
  });

  return lines.length > 0 ? { lines, pageCount: pages.length } : null;
}
