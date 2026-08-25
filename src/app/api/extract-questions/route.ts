import { NextResponse } from "next/server";
import { extractQuestions } from "@/lib/gemini";
import type { SourcePage } from "@/types/exam";

export async function POST(request: Request) {
  const { pages } = (await request.json()) as { pages: SourcePage[] };
  try {
    const questions = await extractQuestions(pages);
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
