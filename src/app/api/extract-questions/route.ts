import { NextResponse } from "next/server";
import { extractQuestions, toFriendlyError } from "@/lib/ai";
import type { SourcePage } from "@/types/exam";

// Vision calls run ~5s per page; a multi-page answer sheet needs well beyond
// Vercel's 10s default. 60s is the Hobby-plan ceiling.
export const maxDuration = 60;

export async function POST(request: Request) {
  const { pages } = (await request.json()) as { pages: SourcePage[] };
  try {
    const questions = await extractQuestions(pages);
    return NextResponse.json({ questions });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Question extraction failed") }, { status: 500 });
  }
}
