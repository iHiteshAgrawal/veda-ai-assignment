import { NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/store";
import { mapAnswersToQuestions } from "@/lib/gemini";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = getSession(id);
  if (!session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

  updateSession(id, { stage: "mapping", error: null });

  try {
    const mappings = await mapAnswersToQuestions(session.questions, session.answers);
    updateSession(id, { mappings, stage: "done" });
    return NextResponse.json({ mappings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Answer mapping failed";
    updateSession(id, { stage: "error", error: message });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
