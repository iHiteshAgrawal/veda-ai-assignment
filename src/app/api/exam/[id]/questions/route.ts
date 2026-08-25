import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/store";
import { extractQuestions } from "@/lib/gemini";
import type { SourcePage } from "@/types/exam";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  const { pages } = (await request.json()) as { pages: SourcePage[] };
  updateSession(id, { stage: "extracting_questions", questionPaperPages: pages, error: null });

  try {
    const questions = await extractQuestions(pages);
    updateSession(id, { questions });
    return NextResponse.json({ questions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Question extraction failed";
    updateSession(id, { stage: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
