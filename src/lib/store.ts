import type { ExamSession } from "@/types/exam";

/**
 * In-memory session store — no DB required per the assignment constraints.
 * Lives for the lifetime of the server process; fine for a single-teacher,
 * single-session demo. Kept on `globalThis` so it survives Next.js dev-mode
 * module reloads (otherwise every hot reload would wipe active sessions).
 */
declare global {
  var __examSessions: Map<string, ExamSession> | undefined;
}

const sessions = globalThis.__examSessions ?? new Map<string, ExamSession>();
globalThis.__examSessions = sessions;

// Sessions are ephemeral scratch state — cap how many/how long we hold on to
// them so a long-running dev server doesn't accumulate memory indefinitely.
const MAX_SESSIONS = 50;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function evictStale() {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [id, session] of sessions) {
    if (session.createdAt < cutoff) sessions.delete(id);
  }
  while (sessions.size > MAX_SESSIONS) {
    const oldestKey = sessions.keys().next().value;
    if (oldestKey === undefined) break;
    sessions.delete(oldestKey);
  }
}

export function createSession(): ExamSession {
  evictStale();
  const session: ExamSession = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    stage: "idle",
    error: null,
    questionPaperPages: [],
    answerSheetPages: [],
    questions: [],
    answers: [],
    mappings: [],
    grading: null,
  };
  sessions.set(session.id, session);
  return session;
}

export function getSession(id: string): ExamSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, patch: Partial<ExamSession>): ExamSession {
  const existing = sessions.get(id);
  if (!existing) throw new Error(`Unknown session: ${id}`);
  const updated = { ...existing, ...patch };
  sessions.set(id, updated);
  return updated;
}
