"use client";

import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { useState } from "react";
import type { NormalizedBox, SourcePage } from "@/types/exam";

export function AnswerSheetPanel({
  pages,
  currentPageIndex,
  onPageChange,
  highlightBoxes,
  highlightLabel,
  notice,
}: {
  pages: SourcePage[];
  currentPageIndex: number;
  onPageChange: (index: number) => void;
  highlightBoxes: NormalizedBox[];
  highlightLabel: string | null;
  notice: string | null;
}) {
  const [zoom, setZoom] = useState(100);
  const page = pages[currentPageIndex];
  const boxesOnPage = highlightBoxes.filter((box) => box.page === currentPageIndex);

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-surface">
      <div className="flex items-center justify-between bg-panel-dark px-4 py-3">
        <span className="text-sm font-semibold text-white">Answer Sheet</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-panel-dark-soft px-3 py-1.5 text-white">
            <button onClick={() => setZoom((z) => Math.max(50, z - 10))} aria-label="Zoom out">
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-10 text-center text-xs font-medium">{zoom}%</span>
            <button onClick={() => setZoom((z) => Math.min(200, z + 10))} aria-label="Zoom in">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-panel-dark-soft px-3 py-1.5 text-white">
            <button
              onClick={() => onPageChange(Math.max(0, currentPageIndex - 1))}
              disabled={currentPageIndex === 0}
              aria-label="Previous page"
              className="disabled:opacity-30"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs font-medium">
              Page {currentPageIndex + 1} of {pages.length}
            </span>
            <button
              onClick={() => onPageChange(Math.min(pages.length - 1, currentPageIndex + 1))}
              disabled={currentPageIndex === pages.length - 1}
              aria-label="Next page"
              className="disabled:opacity-30"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {notice && (
        <p className="bg-warning-soft px-4 py-2 text-xs font-medium text-warning">{notice}</p>
      )}

      <div className="flex-1 overflow-auto bg-neutral-200 p-4">
        {page ? (
          <div className="relative mx-auto" style={{ width: `${zoom}%` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={page.dataUrl} alt={`Answer sheet page ${currentPageIndex + 1}`} className="w-full rounded-lg" />
            {boxesOnPage.map((box, i) => (
              <div key={i}>
                <div
                  className="absolute rounded-md border-2 border-success bg-success/15"
                  style={{
                    top: `${box.yMin / 10}%`,
                    left: `${box.xMin / 10}%`,
                    width: `${(box.xMax - box.xMin) / 10}%`,
                    height: `${(box.yMax - box.yMin) / 10}%`,
                  }}
                />
                {highlightLabel && i === 0 && (
                  <span
                    className="absolute -translate-y-full rounded-t-md rounded-br-md bg-success px-2 py-0.5 text-xs font-bold text-white"
                    style={{ top: `${box.yMin / 10}%`, left: `${box.xMin / 10}%` }}
                  >
                    {highlightLabel}
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="p-8 text-center text-sm text-neutral-400">No pages to display.</p>
        )}
      </div>
    </div>
  );
}
