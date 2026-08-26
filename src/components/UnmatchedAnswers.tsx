import type { ExamSession, Mapping } from "@/types/exam";

/**
 * Answers the student wrote that don't correspond to any question on the paper
 * — an answer to a question from a different paper, or one whose label was
 * illegible. Surfaced explicitly so nothing the student wrote silently vanishes
 * from the teacher's view.
 */
export function UnmatchedAnswers({
  session,
  mappings,
}: {
  session: ExamSession;
  mappings: Mapping[];
}) {
  if (mappings.length === 0) return null;

  return (
    <>
      <h2 className="mt-2 px-1 text-sm font-semibold text-brand-dark">
        Unmatched answers ({mappings.length})
      </h2>
      {mappings.map((mapping) => {
        const answer = session.answers.find((a) => a.id === mapping.answerId);
        if (!answer) return null;
        return (
          <div key={mapping.answerId} className="rounded-2xl bg-surface p-4">
            <p className="text-sm text-neutral-500">
              {answer.declaredLabel ? `Labelled "${answer.declaredLabel}"` : "No label found"} —
              doesn&apos;t match any question on this paper.
            </p>
            <p className="mt-2 text-xs text-neutral-400 italic">&quot;{answer.transcript}&quot;</p>
          </div>
        );
      })}
    </>
  );
}
