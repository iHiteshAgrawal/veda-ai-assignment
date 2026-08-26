import { extractAnswers, extractAnswersFromLines } from "@/lib/ai";
import { handlePipelineRoute } from "@/lib/api";
import { boxesForLineIds } from "@/lib/line-index";
import { normalizeAnswerBoxes } from "@/lib/boxes";
import { extractAnswersBody } from "@/lib/schemas";
import { buildVisionLineIndex, isVisionConfigured } from "@/lib/vision";
import type { AnswerBlock } from "@/types/exam";

// Vision calls run ~5s per page; a multi-page answer sheet needs well beyond
// Vercel's 10s default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handlePipelineRoute(request, extractAnswersBody, "Answer extraction failed", async ({ pages }) => {
    // Preferred path: an OCR engine measures where the ink is, the model reads
    // what it says, and location comes back as line IDs — so the highlight
    // geometry is measured rather than generated.
    if (isVisionConfigured()) {
      try {
        const index = await buildVisionLineIndex(pages);
        if (index) {
          const selections = await extractAnswersFromLines(pages, index);
          const answers: AnswerBlock[] = selections
            .map((selection) => ({
              id: crypto.randomUUID(),
              transcript: selection.transcript,
              declaredLabel: selection.declaredLabel,
              boxes: normalizeAnswerBoxes(boxesForLineIds(index, selection.lineIds ?? [])),
            }))
            .filter((answer) => answer.transcript.trim().length > 0);

          if (answers.length > 0) return { answers, geometry: "measured" as const };
        }
      } catch (error) {
        // OCR is an enhancement, not a dependency: if Vision is down, misconfigured,
        // or out of quota, fall through to the model-estimated path rather than
        // failing an upload the app can still largely handle.
        console.warn("[vision] falling back to model-estimated boxes:", error);
      }
    }

    return { answers: await extractAnswers(pages), geometry: "estimated" as const };
  });
}
