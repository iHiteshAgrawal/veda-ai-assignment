import { NextResponse } from "next/server";
import type { z } from "zod";
import { toFriendlyError } from "@/lib/ai";

/**
 * Shared route wrapper. Every pipeline route has the same shape — validate the
 * body, call one provider function, translate failures — so it lives here once
 * instead of being copy-pasted five times with slightly different error handling.
 */
export async function handlePipelineRoute<TBody, TResult>(
  request: Request,
  schema: z.ZodType<TBody>,
  failureMessage: string,
  run: (body: TBody) => Promise<TResult>
): Promise<NextResponse> {
  let parsed: TBody;
  try {
    parsed = schema.parse(await request.json());
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Invalid request body";
    return NextResponse.json({ error: `Invalid request: ${detail}` }, { status: 400 });
  }

  try {
    return NextResponse.json(await run(parsed));
  } catch (error) {
    // Logged server-side with the real error; the client sees only the
    // translated message so provider internals and keys never leak.
    console.error(`[${failureMessage}]`, error);
    return NextResponse.json({ error: toFriendlyError(error, failureMessage) }, { status: 500 });
  }
}
