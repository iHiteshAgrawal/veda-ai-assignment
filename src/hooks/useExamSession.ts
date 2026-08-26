"use client";

import { get } from "idb-keyval";
import { useEffect, useState } from "react";
import { normalizeAnswerBoxes } from "@/lib/boxes";
import type { ExamSession } from "@/types/exam";

export type ExamSessionState =
  | { status: "loading"; session: null }
  | { status: "not-found"; session: null }
  | { status: "ready"; session: ExamSession };

/**
 * Loads a completed exam session from this browser's IndexedDB.
 *
 * Sessions live client-side because a serverless deployment has no long-lived
 * process to hold them, so "not found" is a normal outcome — a different
 * browser, cleared site data, or an upload that never finished — rather than
 * an error.
 */
export function useExamSession(id: string): ExamSessionState {
  const [state, setState] = useState<ExamSessionState>({ status: "loading", session: null });

  useEffect(() => {
    let cancelled = false;

    get<ExamSession>(id)
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setState({ status: "not-found", session: null });
          return;
        }
        // Re-normalise on read: sessions stored before box validation existed
        // can still hold incomplete coordinates, which would render as NaN CSS.
        setState({
          status: "ready",
          session: {
            ...data,
            answers: data.answers.map((a) => ({ ...a, boxes: normalizeAnswerBoxes(a.boxes) })),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "not-found", session: null });
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  return state;
}
