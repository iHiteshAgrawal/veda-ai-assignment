import { NextResponse } from "next/server";
import { extractQuestions, toFriendlyError } from "@/lib/ai";
import type { SourcePage } from "@/types/exam";

export async function POST(request: Request) {
  const { pages } = (await request.json()) as { pages: SourcePage[] };
  try {
    const questions = await extractQuestions(pages);
    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Question extraction failed") }, { status: 500 });
  }
}
