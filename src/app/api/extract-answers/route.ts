import { NextResponse } from "next/server";
import { extractAnswers } from "@/lib/gemini";
import type { SourcePage } from "@/types/exam";

export async function POST(request: Request) {
  const { pages } = (await request.json()) as { pages: SourcePage[] };
  try {
    const answers = await extractAnswers(pages);
    return NextResponse.json({ answers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Answer extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
