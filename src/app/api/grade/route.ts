import { NextResponse } from "next/server";
import { gradeAnswers } from "@/lib/gemini";
import type { AnswerBlock, Mapping, Question } from "@/types/exam";

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
    const message = error instanceof Error ? error.message : "Grading failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
