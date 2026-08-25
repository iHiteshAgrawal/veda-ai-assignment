import { Sparkles } from "lucide-react";
import type { PipelineStage } from "@/types/exam";

const STAGE_LABEL: Partial<Record<PipelineStage, string>> = {
  uploading: "Uploading...",
  extracting: "Extracting...",
  mapping: "Mapping...",
  grading: "Grading...",
};

export function ProcessingProgress({ stage }: { stage: PipelineStage }) {
  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-4 rounded-2xl bg-surface">
      <Sparkles className="h-16 w-16 text-brand-orange" fill="currentColor" />
      <h2 className="text-2xl font-bold text-brand-dark">{STAGE_LABEL[stage] ?? "Processing..."}</h2>
      <p className="text-neutral-400">This may take a while</p>
    </div>
  );
}
