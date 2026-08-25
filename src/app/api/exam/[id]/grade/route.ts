import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/store";
import { gradeAnswers } from "@/lib/gemini";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  updateSession(id, { stage: "grading", error: null });

  try {
    const grading = await gradeAnswers(session.questions, session.answers, session.mappings);
    updateSession(id, { grading, stage: "done" });
    return NextResponse.json({ grading });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Grading failed";
    updateSession(id, { stage: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
