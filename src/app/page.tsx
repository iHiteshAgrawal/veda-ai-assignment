"use client";

import { set } from "idb-keyval";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { MascotAvatar } from "@/components/MascotAvatar";
import { ProcessingProgress } from "@/components/ProcessingProgress";
import { UploadDropzone } from "@/components/UploadDropzone";
import { rasterizeFile } from "@/lib/rasterize";
import type { AnswerBlock, ExamSession, Mapping, PipelineStage, Question } from "@/types/exam";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

export default function UploadPage() {
  const router = useRouter();
  const [questionPaperFile, setQuestionPaperFile] = useState<File | null>(null);
  const [answerSheetFile, setAnswerSheetFile] = useState<File | null>(null);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const canStart = questionPaperFile && answerSheetFile && stage === "idle";
  const isProcessing = stage !== "idle" && stage !== "error";

  async function handleStartMapping() {
    if (!questionPaperFile || !answerSheetFile) return;
    setError(null);
    try {
      setStage("uploading");
      const [questionPaperPages, answerSheetPages] = await Promise.all([
        rasterizeFile(questionPaperFile),
        rasterizeFile(answerSheetFile),
      ]);

      setStage("extracting_questions");
      const { questions } = await postJson<{ questions: Question[] }>("/api/extract-questions", {
        pages: questionPaperPages,
      });

      setStage("extracting_answers");
      const { answers } = await postJson<{ answers: AnswerBlock[] }>("/api/extract-answers", {
        pages: answerSheetPages,
      });

      setStage("mapping");
      const { mappings } = await postJson<{ mappings: Mapping[] }>("/api/map-answers", {
        questions,
        answers,
      });

      setStage("grading");
      const { grading } = await postJson<{ grading: ExamSession["grading"] }>("/api/grade", {
        questions,
        answers,
        mappings,
      });

      const session: ExamSession = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        stage: "done",
        error: null,
        questionPaperPages,
        answerSheetPages,
        questions,
        answers,
        mappings,
        grading,
      };

      // Held in the browser's IndexedDB rather than server memory — a serverless
      // deployment has no single long-lived process for a Map to survive in,
      // so cross-request server-side state isn't reliable there. The browser
      // tab that ran the upload is the only place this data needs to live.
      await set(session.id, session);

      setStage("done");
      router.push(`/exam/${session.id}`);
    } catch (err) {
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
