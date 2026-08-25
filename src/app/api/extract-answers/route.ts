import { extractAnswers } from "@/lib/ai";
import { handlePipelineRoute } from "@/lib/api";
import { extractAnswersBody } from "@/lib/schemas";

// Vision calls run ~5s per page; a multi-page answer sheet needs well beyond
// Vercel's 10s default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handlePipelineRoute(request, extractAnswersBody, "Answer extraction failed", async ({ pages }) => ({
    answers: await extractAnswers(pages),
  }));
}
