import type { AnswerBlock, GradingSummary, Mapping, Question, SourcePage } from "@/types/exam";
import * as gemini from "./gemini";
import * as openrouter from "./openrouter";

/**
 * AI_PROVIDER selects which implementation runs — defaults to Gemini's free
 * tier; switch to "openrouter" (credits-billed) if that quota runs dry or
 * its output quality isn't good enough. Both implementations share the same
 * prompts (./prompts.ts) and return the same shapes, so nothing else in the
 * app needs to know which one is active.
 */
function currentProvider() {
  return process.env.AI_PROVIDER === "openrouter" ? openrouter : gemini;
}

export function extractQuestions(pages: SourcePage[]): Promise<Question[]> {
  return currentProvider().extractQuestions(pages);
}

export function extractAnswers(pages: SourcePage[]): Promise<AnswerBlock[]> {
  return currentProvider().extractAnswers(pages);
}

export function mapAnswersToQuestions(questions: Question[], answers: AnswerBlock[]): Promise<Mapping[]> {
  return currentProvider().mapAnswersToQuestions(questions, answers);
}

export function gradeAnswers(
  questions: Question[],
  answers: AnswerBlock[],
  mappings: Mapping[]
): Promise<GradingSummary> {
  return currentProvider().gradeAnswers(questions, answers, mappings);
}

export function toFriendlyError(err: unknown, fallback: string): string {
  return currentProvider().toFriendlyError(err, fallback);
}
