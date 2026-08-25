import { describe, expect, it, vi } from "vitest";
import { TimeoutError, chunk, mapWithConcurrency, withTimeout } from "./async";

describe("mapWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const result = await mapWithConcurrency([30, 10, 20], 3, async (ms) => {
      await new Promise((r) => setTimeout(r, ms));
      return ms;
    });
    expect(result).toEqual([30, 10, 20]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
    });
    expect(peak).toBeLessThanOrEqual(3);
  });

  it("handles an empty input", async () => {
    expect(await mapWithConcurrency([], 4, async () => 1)).toEqual([]);
  });

  it("rejects a nonsensical limit rather than hanging", async () => {
    await expect(mapWithConcurrency([1], 0, async () => 1)).rejects.toThrow(/>= 1/);
  });

  it("propagates a worker failure", async () => {
    await expect(
      mapWithConcurrency([1, 2], 2, async (n) => {
        if (n === 2) throw new Error("boom");
        return n;
      })
    ).rejects.toThrow("boom");
  });
});

describe("chunk", () => {
  it("splits into fixed-size groups with a short final group", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns nothing for an empty input", () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it("rejects a zero size rather than looping forever", () => {
    expect(() => chunk([1], 0)).toThrow(/>= 1/);
  });
});

describe("withTimeout", () => {
  it("passes through a value that resolves in time", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 50, "test")).resolves.toBe("ok");
  });

  it("rejects with a labelled TimeoutError when it overruns", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(new Promise(() => {}), 1000, "Gemini request");
    const assertion = expect(pending).rejects.toThrow(TimeoutError);
    await vi.advanceTimersByTimeAsync(1001);
    await assertion;
    vi.useRealTimers();
  });

  it("propagates the original rejection rather than masking it as a timeout", async () => {
    await expect(withTimeout(Promise.reject(new Error("upstream")), 50, "test")).rejects.toThrow(
      "upstream"
    );
  });
});
