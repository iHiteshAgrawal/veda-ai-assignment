import { extractQuestions } from "@/lib/ai";
import { handlePipelineRoute } from "@/lib/api";
import { extractQuestionsBody } from "@/lib/schemas";

// Vision calls run ~5s per page; a multi-page answer sheet needs well beyond
// Vercel's 10s default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handlePipelineRoute(request, extractQuestionsBody, "Question extraction failed", async ({ pages }) => ({
    questions: await extractQuestions(pages),
  }));
}
