"use client";

import { FileText, Upload, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPageCount } from "@/lib/rasterize";

const ACCEPTED_TYPES = "application/pdf,image/png,image/jpeg,image/webp";
const MAX_SIZE_MB = 10;

function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(mb < 10 ? 1 : 0)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

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
  const [pageCountEntry, setPageCountEntry] = useState<{ file: File; count: number } | null>(null);
  const pageCount = pageCountEntry?.file === file ? pageCountEntry.count : null;

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    getPageCount(file).then((count) => {
      if (!cancelled) setPageCountEntry({ file, count });
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

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
        <div className="relative flex w-full max-w-sm items-center gap-3 rounded-xl bg-surface-muted px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate text-sm font-semibold text-brand-dark">{file.name}</p>
            <p className="text-xs text-neutral-400">
              {formatSize(file.size)}
              {pageCount !== null && ` · ${pageCount} Page${pageCount === 1 ? "" : "s"}`}
            </p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
              setError(null);
            }}
            className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-dark text-white"
            aria-label="Remove file"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
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
