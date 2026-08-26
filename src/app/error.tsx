"use client";

import { catchError, type ErrorInfo } from "next/error";

/**
 * Next 16.3's `catchError` boundary. Unlike a plain React error boundary it
 * doesn't swallow `notFound()` / `redirect()`, and its `retry()` re-renders the
 * failed subtree — including re-running Server Components — so a transient
 * failure can be recovered from without a full page reload.
 */
function ErrorFallback(_props: Record<string, never>, { error, retry }: ErrorInfo) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="flex max-w-md flex-col items-start gap-3 rounded-2xl bg-surface p-8">
        <h1 className="text-lg font-semibold text-brand-dark">Something went wrong</h1>
        <p className="text-sm text-neutral-500">
          {error instanceof Error && error.message ? error.message : "The page failed to load."}
        </p>
        <button
          onClick={() => retry()}
          className="mt-2 rounded-full bg-brand-dark px-5 py-2.5 text-sm font-semibold text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export default catchError(ErrorFallback);
