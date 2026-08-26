"use client";

import { useCallback, useMemo, useState } from "react";
import type { AnswerBlock, ExamSession, Mapping, Question } from "@/types/exam";

export interface QuestionSelection {
  selectedQuestionId: string | null;
  selectedQuestion: Question | undefined;
  selectedMapping: Mapping | undefined;
  selectedAnswer: AnswerBlock | undefined;
  currentPageIndex: number;
  setCurrentPageIndex: (index: number) => void;
  expandedIds: ReadonlySet<string>;
  allExpanded: boolean;
  selectQuestion: (questionId: string) => void;
  toggleExpand: (questionId: string) => void;
  toggleExpandAll: () => void;
}

/**
 * Selection state for the question list: which question is active, which cards
 * are expanded, and which answer-sheet page is in view.
 *
 * Selecting a question jumps the answer sheet to the page its answer sits on,
 * which is what makes "click a question, see the answer" work when an answer is
 * several pages in.
 */
export function useQuestionSelection(session: ExamSession | null): QuestionSelection {
  // Null means "the user hasn't chosen yet", so the selection can fall back to
  // the first question. Deriving the default rather than syncing it in an
  // effect keeps the two in step without an extra render.
  const [chosenQuestionId, setChosenQuestionId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const chosenExists = chosenQuestionId
    ? session?.questions.some((q) => q.id === chosenQuestionId)
    : false;
  const selectedQuestionId =
    (chosenExists ? chosenQuestionId : null) ?? session?.questions[0]?.id ?? null;

  const selectedMapping = session?.mappings.find((m) => m.questionId === selectedQuestionId);
  const selectedAnswer =
    session && selectedMapping?.answerId
      ? session.answers.find((a) => a.id === selectedMapping.answerId)
      : undefined;
  const selectedQuestion = session?.questions.find((q) => q.id === selectedQuestionId);

  const allExpanded = useMemo(
    () => Boolean(session?.questions.length) && !!session?.questions.every((q) => expandedIds.has(q.id)),
    [session, expandedIds]
  );

  const selectQuestion = useCallback(
    (questionId: string) => {
      setChosenQuestionId(questionId);
      const mapping = session?.mappings.find((m) => m.questionId === questionId);
      const answer = mapping?.answerId
        ? session?.answers.find((a) => a.id === mapping.answerId)
        : undefined;
      if (answer?.boxes.length) setCurrentPageIndex(answer.boxes[0].page);
    },
    [session]
  );

  const toggleExpand = useCallback((questionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }, []);

  const toggleExpandAll = useCallback(() => {
    if (!session) return;
    setExpandedIds(allExpanded ? new Set() : new Set(session.questions.map((q) => q.id)));
  }, [session, allExpanded]);

  return {
    selectedQuestionId,
    selectedQuestion,
    selectedMapping,
    selectedAnswer,
    currentPageIndex,
    setCurrentPageIndex,
    expandedIds,
    allExpanded,
    selectQuestion,
    toggleExpand,
    toggleExpandAll,
  };
}
