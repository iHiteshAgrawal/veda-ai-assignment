import { NextResponse } from "next/server";
import { gradeAnswers, toFriendlyError } from "@/lib/ai";
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
    return NextResponse.json({ error: toFriendlyError(error, "Grading failed") }, { status: 500 });
  }
}
