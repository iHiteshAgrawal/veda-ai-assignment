import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/store";
import { extractAnswers } from "@/lib/gemini";
import type { SourcePage } from "@/types/exam";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { pages } = (await request.json()) as { pages: SourcePage[] };
  updateSession(id, { stage: "extracting_answers", answerSheetPages: pages, error: null });

  try {
    const answers = await extractAnswers(pages);
    updateSession(id, { answers });
    return NextResponse.json({ answers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Answer extraction failed";
    updateSession(id, { stage: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
