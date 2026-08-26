"use client";

import { set } from "idb-keyval";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";
import { ProcessingProgress } from "@/components/ProcessingProgress";
import { UploadDropzone } from "@/components/UploadDropzone";
import { runPipeline } from "@/lib/pipeline";
import type { PipelineStage } from "@/types/exam";

export default function UploadPage() {
  const router = useRouter();
  const [questionPaperFile, setQuestionPaperFile] = useState<File | null>(null);
  const [answerSheetFile, setAnswerSheetFile] = useState<File | null>(null);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const canStart = questionPaperFile && answerSheetFile && stage === "idle";
  const isProcessing = stage !== "idle" && stage !== "error";

  // Abort in-flight work if the user leaves mid-run. Without this, closing the
  // tab during a 15s pipeline leaves model calls running and billing against
  // the quota for a result nobody will see.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function handleStartMapping() {
    if (!questionPaperFile || !answerSheetFile) return;
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const session = await runPipeline(questionPaperFile, answerSheetFile, {
        onStage: setStage,
        signal: controller.signal,
      });

      // Held in the browser's IndexedDB rather than server memory — a serverless
      // deployment has no single long-lived process for a Map to survive in,
      // so cross-request server-side state isn't reliable there. The browser
      // tab that ran the upload is the only place this data needs to live.
      await set(session.id, session);

      router.push(`/exam/${session.id}`);
    } catch (err) {
      // An abort is the user leaving, not a failure worth reporting to them.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStage("error");
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  if (isProcessing) {
    return (
      <AppShell breadcrumb="Exams">
        <ProcessingProgress stage={stage} />
      </AppShell>
    );
  }

  return (
    <AppShell breadcrumb="Exams">
      <div className="flex flex-col items-center gap-8 py-6 text-center lg:py-10">
        <div>
          <h1 className="text-3xl font-bold text-brand-dark lg:text-4xl">
            Upload{" "}
            <span className="rounded-lg bg-brand-orange-soft px-2 py-1 text-brand-orange underline decoration-2 underline-offset-4">
              Question Paper &amp; Answer Sheets
            </span>
          </h1>
          <p className="mt-3 text-neutral-500">Upload both files to get started</p>
        </div>

        <MascotAvatar />

        {stage === "error" && (
          <div className="mx-auto max-w-md rounded-2xl bg-danger-soft p-6 text-center">
            <p className="text-sm font-medium text-danger">{error}</p>
            <button
              onClick={() => setStage("idle")}
              className="mt-4 text-sm font-medium text-brand-orange hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        <div className="flex w-full max-w-3xl flex-col gap-4 sm:flex-row">
          <UploadDropzone label="Question Paper" file={questionPaperFile} onChange={setQuestionPaperFile} />
          <UploadDropzone label="Answer Sheet" file={answerSheetFile} onChange={setAnswerSheetFile} />
        </div>

        <div>
          <button
            disabled={!canStart}
            onClick={handleStartMapping}
            className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${
              canStart
                ? "bg-brand-dark text-white hover:bg-black"
                : "cursor-not-allowed bg-brand-disabled text-white/80"
            }`}
          >
            Start Mapping
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="mt-3 text-xs text-neutral-400">
            Once both files are uploaded, you&apos;ll be able to map answers with questions
          </p>
        </div>
      </div>
    </AppShell>
  );
}
