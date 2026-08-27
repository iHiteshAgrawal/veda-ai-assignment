import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildVisionLineIndex, isVisionConfigured } from "./vision";
import type { SourcePage } from "@/types/exam";

/** Builds a Vision word entry with a rectangular polygon, as the API returns them. */
function word(text: string, x: number, y: number, w = 60, h = 20) {
  return {
    boundingBox: {
      vertices: [
        { x, y },
        { x: x + w, y },
        { x: x + w, y: y + h },
        { x, y: y + h },
      ],
    },
    symbols: text.split("").map((c) => ({ text: c })),
  };
}

/** A 1000x1000 page keeps pixel values equal to the normalised 0-1000 output. */
function visionResponse(blocks: Array<Array<ReturnType<typeof word>>>) {
  return {
    responses: [
      {
        fullTextAnnotation: {
          pages: [
            {
              width: 1000,
              height: 1000,
              blocks: blocks.map((words) => ({ paragraphs: [{ words }] })),
            },
          ],
        },
      },
    ],
  };
}

function mockVision(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, status, json: async () => body }) as unknown as Response)
  );
}

const page: SourcePage = { pageIndex: 0, dataUrl: "data:image/jpeg;base64,AAAA", width: 1000, height: 1000 };

beforeEach(() => {
  vi.stubEnv("GOOGLE_VISION_API_KEY", "test-key");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("isVisionConfigured", () => {
  it("is false without a key, so the pipeline can fall back instead of failing", () => {
    vi.stubEnv("GOOGLE_VISION_API_KEY", "");
    expect(isVisionConfigured()).toBe(false);
  });

  it("is true with a key", () => {
    expect(isVisionConfigured()).toBe(true);
  });
});

describe("buildVisionLineIndex", () => {
  it("merges words sharing a baseline into one line, in left-to-right order", async () => {
    mockVision(visionResponse([[word("15", 200, 100), word("+", 270, 100), word("27", 320, 100)]]));

    const index = await buildVisionLineIndex([page]);
    expect(index?.lines).toHaveLength(1);
    expect(index?.lines[0].text).toBe("15 + 27");
  });

  it("regroups across Vision's own blocks when words sit on the same visual line", async () => {
    // Vision groups by semantic reading order, which on a handwritten sheet
    // puts the question label in a different block from its answer. Grouping by
    // vertical position is what keeps a line matching what a person sees.
    mockVision(
      visionResponse([
        [word("Q3", 40, 100)],
        [word("15", 200, 102), word("=", 270, 101), word("42", 320, 100)],
      ])
    );

    const index = await buildVisionLineIndex([page]);
    expect(index?.lines).toHaveLength(1);
    expect(index?.lines[0].text).toBe("Q3 15 = 42");
    expect(index?.lines[0].box.xMin).toBe(40); // spans from the label to the answer
  });

  it("keeps vertically separated answers on distinct lines", async () => {
    mockVision(visionResponse([[word("first", 40, 100), word("second", 40, 300)]]));

    const index = await buildVisionLineIndex([page]);
    expect(index?.lines).toHaveLength(2);
    expect(index?.lines.map((l) => l.text)).toEqual(["first", "second"]);
  });

  it("normalises polygons onto the 0-1000 axis using Vision's own page size", async () => {
    mockVision(visionResponse([[word("x", 100, 250, 100, 50)]]));

    const box = (await buildVisionLineIndex([page]))?.lines[0].box;
    expect(box).toEqual({ page: 0, xMin: 100, xMax: 200, yMin: 250, yMax: 300 });
  });

  it("numbers lines continuously across pages and tags each with its page", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => visionResponse([[word("p0", 40, 100)]]) })
        .mockResolvedValueOnce({ ok: true, json: async () => visionResponse([[word("p1", 40, 100)]]) })
    );

    const index = await buildVisionLineIndex([page, { ...page, pageIndex: 1 }]);
    expect(index?.lines.map((l) => [l.id, l.box.page])).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it("returns null when the page holds no text, so the caller can fall back", async () => {
    mockVision({ responses: [{}] });
    expect(await buildVisionLineIndex([page])).toBeNull();
  });

  it("surfaces an API error rather than silently producing empty geometry", async () => {
    mockVision({ responses: [{ error: { message: "quota exceeded" } }] });
    await expect(buildVisionLineIndex([page])).rejects.toThrow(/quota exceeded/);
  });

  it("never puts the API key in the error message", async () => {
    mockVision({}, false, 403);
    await expect(buildVisionLineIndex([page])).rejects.toThrow(
      expect.objectContaining({ message: expect.not.stringContaining("test-key") })
    );
  });
});
