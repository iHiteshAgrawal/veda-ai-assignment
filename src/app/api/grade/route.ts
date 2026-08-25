import { gradeAnswers } from "@/lib/ai";
import { handlePipelineRoute } from "@/lib/api";
import { gradeBody } from "@/lib/schemas";

// Vision calls run ~5s per page; a multi-page answer sheet needs well beyond
// Vercel's 10s default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60;

export async function POST(request: Request) {
  return handlePipelineRoute(request, gradeBody, "Grading failed", async ({ questions, answers, mappings }) => ({
    grading: await gradeAnswers(questions, answers, mappings),
  }));
}
