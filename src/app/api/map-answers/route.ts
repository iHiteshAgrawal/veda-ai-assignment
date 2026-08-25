import { NextResponse } from "next/server";
import { mapAnswersToQuestions } from "@/lib/gemini";
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
    const message = error instanceof Error ? error.message : "Answer mapping failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
