import { NextResponse } from "next/server";
import { gradeAnswers, toFriendlyError } from "@/lib/ai";
import type { AnswerBlock, Mapping, Question } from "@/types/exam";

// Vision calls run ~5s per page; a multi-page answer sheet needs well beyond
// Vercel's 10s default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60;

export async function POST(request: Request) {
  const { questions, answers, mappings } = (await request.json()) as {
    questions: Question[];
    answers: AnswerBlock[];
    mappings: Mapping[];
  };
  try {
    const grading = await gradeAnswers(questions, answers, mappings);
    return NextResponse.json({ grading });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Grading failed") }, { status: 500 });
  }
}
