import { NextResponse } from "next/server";
import { mapAnswersToQuestions, toFriendlyError } from "@/lib/ai";
import type { AnswerBlock, Question } from "@/types/exam";

// Vision calls run ~5s per page; a multi-page answer sheet needs well beyond
// Vercel's 10s default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60;

export async function POST(request: Request) {
  const { questions, answers } = (await request.json()) as {
    questions: Question[];
    answers: AnswerBlock[];
  };
  try {
    const mappings = await mapAnswersToQuestions(questions, answers);
    return NextResponse.json({ mappings });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Answer mapping failed") }, { status: 500 });
  }
}
