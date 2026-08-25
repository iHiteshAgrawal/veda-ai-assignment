import { NextResponse } from "next/server";
import { extractAnswers, toFriendlyError } from "@/lib/ai";
import type { SourcePage } from "@/types/exam";

export async function POST(request: Request) {
  const { pages } = (await request.json()) as { pages: SourcePage[] };
  try {
    const answers = await extractAnswers(pages);
    return NextResponse.json({ answers });
  } catch (error) {
    return NextResponse.json({ error: toFriendlyError(error, "Answer extraction failed") }, { status: 500 });
  }
}
