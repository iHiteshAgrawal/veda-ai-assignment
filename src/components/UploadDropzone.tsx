"use client";

import { CheckCircle2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_SIZE_MB = 10;

export function UploadDropzone({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function acceptFile(candidate: File | undefined) {
    if (!candidate) return;
    if (candidate.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Max ${MAX_SIZE_MB}MB`);
      return;
    }
    setError(null);
    onChange(candidate);
  }

  return (
    <div
      onClick={() => !file && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        acceptFile(e.dataTransfer.files?.[0]);
      }}
      className={`flex flex-1 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed bg-surface px-6 py-10 text-center transition-colors ${
        dragOver ? "border-brand-orange bg-brand-orange-soft/40" : "border-neutral-300"
      } ${!file ? "cursor-pointer" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0])}
      />

      {file ? (
        <>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted text-brand-orange">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <p className="max-w-full truncate px-4 text-sm font-medium text-brand-dark">{file.name}</p>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setError(null);
            }}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-brand-orange"
          >
            <X className="h-3.5 w-3.5" />
            Remove
          </button>
        </>
      ) : (
        <>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-muted">
            <Upload className="h-5 w-5 text-brand-dark" />
          </div>
          <p className="text-base font-semibold text-brand-dark">
            Upload <span className="text-brand-orange">{label}</span>
          </p>
          <p className="text-xs text-neutral-400">{error ?? `Max ${MAX_SIZE_MB}MB`}</p>
        </>
      )}
    </div>
  );
}
