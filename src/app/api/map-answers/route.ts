import { NextResponse } from "next/server";
import { mapAnswersToQuestions, toFriendlyError } from "@/lib/ai";
import type { AnswerBlock, Question } from "@/types/exam";

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
