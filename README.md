# VedaAI — Exam Answer Mapper

Upload a question paper and a student's handwritten answer sheet. The app extracts every
question, transcribes the answers, works out which answer belongs to which question, grades
them, and — when you click a question — highlights **exactly where on the sheet** that answer
was written.

- **Live demo:** https://veda-ai-three-bay.vercel.app/
- **Repository:** https://github.com/iHiteshAgrawal/veda-ai

---

## The core problem, and how this solves it

The hard requirement isn't extraction or grading — it's *"highlight the exact region of the
answer sheet."* Getting that wrong is very easy, and the failure is subtle.

The obvious approach is to ask a vision model for bounding boxes. **That doesn't work
reliably, and we have the data to show it.** A generative model doesn't *measure* coordinates,
it *generates* them — so it produces plausible-looking numbers that may not correspond to
anything on the page. Observed during development:

| Model | Failure |
|---|---|
| `gemini-flash-lite-latest` | Omitted `yMin` on **5 of 6 boxes** despite a required response schema |
| `gpt-4o-mini` | Returned uniform, evenly-spaced bands that ignored actual text extents |
| every model tested | Split one answer into several stacked rectangles |

Notably, **transcription was correct in every run.** The reading was never the problem; the
geometry was.

So the pipeline splits the job by what each tool is actually good at:

> **Measure the geometry. Infer the meaning.**

| Stage | Tool | Why |
|---|---|---|
| Where the ink is | Google Cloud Vision OCR (word polygons) / PDF text layer | These *measure* — real coordinates, not estimates |
| What it says | Gemini (vision) | Reads handwriting better than OCR does |
| Which answer goes with which question | Gemini (text-only) | Semantic judgement |
| Grading | Gemini (text-only, batched) | Semantic judgement |

The model reports *location* by naming **line IDs** from a pre-measured index — never
coordinates. Highlight boxes are the union of those measured lines. A hallucinated coordinate
becomes structurally impossible rather than merely rare: the worst case is highlighting the
wrong *real* line, which is visible and debuggable, instead of a rectangle floating in space.

Vision's own reading is kept out of the transcript deliberately. On the test sheet it read
`15 + 27 = 42` as `1527 42`, while Gemini read it correctly.

## Pipeline

```
question paper ──> text layer? ──yes──> line index ──┐
                        │                            ├──> map ──> grade (batched, parallel)
                        └──no──> vision extraction ──┤
answer sheet ──> Vision OCR ──> line index ──────────┘
                 (falls back to model-estimated boxes if unavailable)
```

The two branches are independent until the mapping step, so they run concurrently — the
critical path is the slower branch, not the sum. On a single-page upload that's ~20s of API
time completing in ~14–16s wall clock.

## Handling the required edge cases

| Requirement | How |
|---|---|
| Every question, in printed order | Extraction preserves document order |
| Sub-parts as separate entries | `11(a)` and `11(b)` become two questions sharing `parentNumber: "11"` |
| Original numbering preserved | The printed label is stored verbatim and rendered as-is |
| Answers out of order | Mapping matches on written label and semantic content, not position |
| Unanswered questions | Reconciliation derives them; UI shows "Not answered" plus an explicit notice |
| Answers matching no question | Surfaced in a separate "Unmatched answers" section |
| Answers spanning pages | One answer block holds boxes across pages; selecting it jumps to the right page |
| Exact region highlighted | Union of OCR-measured lines, drawn as a percentage overlay so it survives zoom |

## Reliability: trust the model for judgement, not bookkeeping

Two bugs found in testing shaped the architecture, and both are now structurally prevented:

**Self-contradictory mappings.** The model returned a row pairing a question with an answer
while simultaneously tagging it `unmatched_answer`, orphaning that question's real answer.
Grading then read the wrong pairing and scored a correct answer 0/10.
`reconcileMappings()` now keeps only unambiguously-stated pairings and *derives* everything
else, guaranteeing by construction that every question appears exactly once, every answer at
most once, and each row's IDs agree with its status.

**Arithmetic.** Grading reported `35/40` for five questions whose own per-question maxScores
summed to 50 — silently dropping the unanswered question from the denominator and inflating
the percentage. Totals are now summed in code.

Alongside those: bounding boxes are validated and clamped before they can reach the DOM
(a missing coordinate previously became `top: NaN%`, which browsers discard — that was the
cause of misplaced highlights), stacked boxes belonging to one answer are merged, and provider
calls retry only on rate-limit errors with backoff.

## Tech stack

- **Next.js 16.3** (App Router) / **React 19** / **TypeScript** / **Tailwind CSS v4**
- **Gemini** (`gemini-3.6-flash`) for extraction, mapping, and grading
- **Google Cloud Vision** (`DOCUMENT_TEXT_DETECTION`) for measured answer-sheet geometry
- **OpenRouter** as a switchable alternate provider
- **pdf.js** for rasterisation and text-layer extraction
- **Zod** for request validation, **Vitest** for tests, **idb-keyval** for client storage

## Running locally

```bash
npm install
cp .env.example .env      # then fill in the keys below
npm run dev
```

| Variable | Required | Purpose |
|---|---|---|
| `GEMINI_API_KEY` | yes | Extraction, mapping, grading |
| `GOOGLE_VISION_API_KEY` | recommended | OCR-measured highlights; without it boxes fall back to model estimates |
| `OPENROUTER_API_KEY` | optional | Only when `AI_PROVIDER=openrouter` |
| `AI_PROVIDER` | optional | `gemini` (default) or `openrouter` |
| `GEMINI_MODEL` / `OPENROUTER_MODEL` | optional | Model overrides |

For Vision: enable **Cloud Vision API** (`vision.googleapis.com`) in a GCP project with billing
enabled — the first 1,000 pages/month are free.

```bash
npm test          # unit tests
npm run lint
npm run build
```

## Design decisions

Things deliberately **not** done, and why — these were choices, not omissions:

**No database.** Results are written to the browser's IndexedDB. An earlier version kept
sessions in a server-side `Map`, which works locally but breaks on Vercel: each serverless
invocation may land on a different container, so the session written by one request is invisible
to the next. Since there's one user and no auth, the browser that ran the upload is the only
place the data needs to live. The trade-off is that a results link only opens in the browser
that created it — the UI says so explicitly rather than failing silently.

**No monorepo.** One deployable, no second consumer of any package. Workspace tooling would add
build orchestration and indirection with nothing to share.

**No nginx / Docker.** Vercel already provides the reverse proxy, CDN, and TLS. Adding nginx
would mean moving to a VM and inheriting TLS renewal, scaling, and deploys for no gain.

**No TanStack Query / SWR.** These are server-state caches. Every upload is unique, results are
immutable once written, and the results page reads local storage — there is no server state to
cache, dedupe, or revalidate. Retry already lives at the provider level where it can distinguish
rate limits from real failures.

**No self-hosted OCR.** Open-source OCR is weakest precisely at handwriting; a hosted API is
more accurate than what we'd run on our own GPU, without the ops.

**Vision is optional, not required.** If the key is absent or the API errors, the pipeline logs
and falls back to model-estimated boxes rather than failing the upload. Degraded, not broken.

## Assumptions and limitations

- **Marks per question default to 10** unless the question text states otherwise; the papers
  tested didn't carry explicit mark allocations.
- **English only** — Vision is called with `languageHints: ["en"]`.
- **Serverless time limit.** Routes are capped at Vercel's 60s ceiling. A large multi-page
  upload could exceed it; the fix is moving the pipeline to a background job with polling, which
  is the next architectural step rather than a tuning exercise.
- **Results are per-browser** (see above).
- **Grading quality varies with model choice.** Smaller/cheaper models were measurably worse at
  both schema adherence and judgement, which is why the default is not the cheapest option.
- **Handwriting quality is the main accuracy variable.** Line grouping uses a vertical-proximity
  tolerance tuned on test documents; unusually slanted or cramped handwriting may need it
  adjusted.

## Tests

47 unit tests over the pure logic, each pinned to a bug actually encountered — malformed boxes,
cross-page merge behaviour, self-contradictory mappings, grading arithmetic, concurrency limits.
CI runs lint, types, tests, and build on every push.

```
src/lib/boxes.test.ts          box validation, merging, page separation
src/lib/async.test.ts          concurrency bounds, chunking, timeouts
src/lib/text-layer.test.ts     line-ID to geometry resolution
src/lib/ai/reconcile.test.ts   mapping invariants, grading totals
src/lib/vision.test.ts         OCR line grouping, coordinate normalisation
```
