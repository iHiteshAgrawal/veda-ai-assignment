import { CheckCircle2, Loader2 } from "lucide-react";
import type { PipelineStage } from "@/types/exam";

const STEPS: { key: PipelineStage; label: string }[] = [
  { key: "uploading", label: "Uploading files" },
  { key: "extracting_questions", label: "Extracting questions from the question paper" },
  { key: "extracting_answers", label: "Extracting answers from the answer sheet" },
  { key: "mapping", label: "Mapping answers to questions" },
  { key: "grading", label: "Grading & generating feedback" },
];

export function ProcessingProgress({ stage }: { stage: PipelineStage }) {
  const currentIndex = STEPS.findIndex((s) => s.key === stage);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-3 rounded-2xl bg-surface p-6">
      {STEPS.map((step, i) => {
        const done = currentIndex > i || stage === "done";
        const active = i === currentIndex && stage !== "done";
        return (
          <div key={step.key} className="flex items-center gap-3">
            {done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-orange" />
            ) : active ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-brand-orange" />
            ) : (
              <div className="h-5 w-5 shrink-0 rounded-full border-2 border-neutral-200" />
            )}
            <span className={`text-sm ${done || active ? "text-brand-dark" : "text-neutral-400"}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
