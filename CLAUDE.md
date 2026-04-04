# Readily — Claude Code Notes

## What this is

Take-home interview project for Readily.co, an AI medical compliance platform. The app automates healthcare compliance audit preparation: upload an audit questionnaire PDF, AI extracts the questions, then evaluates each question against a library of policy documents and returns pass/fail verdicts with exact policy evidence.

## Running the app

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
```

Requires `.env.local` with:
```
GOOGLE_GENERATIVE_AI_API_KEY=your_key_here
```

Get a key at https://aistudio.google.com/apikey

## Tech stack

- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS 3 + shadcn/ui (Radix primitives) + Lucide icons
- **AI**: Gemini 2.0 Flash via `@ai-sdk/google` (Vercel AI SDK)
- **State (server)**: In-memory singleton (`lib/store/index.ts`) — resets on server restart, fine for demo
- **State (client)**: Local React state in `PrepWorkspace.tsx` — no Zustand yet
- **PDF parsing**: `pdf-parse` via `require("pdf-parse/lib/pdf-parse")` (sub-path avoids test file side effect)
- **Retrieval**: TF-IDF keyword scoring (`lib/retrieval/keywordSearch.ts`) — no embeddings/vector DB

## Key files

| File | Purpose |
|---|---|
| `lib/store/types.ts` | All TypeScript interfaces — start here |
| `lib/store/index.ts` | In-memory server store singleton |
| `lib/seed/index.ts` | Loads PDFs from `policies/` into the store on first request |
| `lib/ai/extractQuestions.ts` | Gemini call to extract questions from questionnaire PDF |
| `lib/ai/evaluateQuestion.ts` | Gemini call to evaluate one question against policy chunks |
| `app/api/audits/[id]/evaluate/route.ts` | Streaming NDJSON route — evaluates all questions, streams results back |
| `components/audit/PrepWorkspace.tsx` | Core state machine (idle→extracting→review→ready→evaluating→complete) |

## Policy library

373 PDF files in `policies/` organized in 10 folders (AA, CMC, DD, EE, FF, GA, GG, HH, MA, PA). These are the real policy documents provided by the interview. They are parsed and chunked into ~800-token segments at server startup via `ensureSeeded()`.

The `ensureSeeded()` function is called at the top of every API route that needs policy data. It is idempotent and only runs once per server process.

## Audit workflow (state machine)

```
idle → (upload PDF) → extracting → review → ready → evaluating → complete
                                                              ↑          |
                                                              └──────────┘ (re-run)
```

- **idle**: Show empty state + "Upload Questionnaire" button
- **extracting**: PDF uploaded, AI extracting questions
- **review**: User reviews/edits extracted questions, confirms
- **ready**: Questions confirmed, show "Run Audit" button
- **evaluating**: AI evaluating each question, streaming results live via NDJSON
- **complete**: Show results — pass/fail per question with evidence, remediation todo list

## AI calls

Both use `generateObject` from Vercel AI SDK with Zod schemas (no freeform parsing).

**Extraction**: Single call, full PDF text → `Question[]`

**Evaluation**: One call per question, top-6 retrieved chunks → `{ verdict, confidence, evidenceText, sourceDocumentTitle, sourceSectionTitle, reasoning }`

Retrieval is keyword/TF-IDF (`lib/retrieval/keywordSearch.ts`) — no embeddings needed at demo scale.

## Hardcoded demo values

- **User**: "Sarah Chen", Compliance Officer (hardcoded in `components/layout/UserBadge.tsx`)
- **"Marked compliant by"**: Always "Sarah Chen"
- Settings/Profile/Log Out in the user menu are UI-only (no-ops)

## What's not built yet

- Confetti animation on the all-pass celebration modal
- Compliance score gauge/visual on the audit detail header
- Policy document full-text viewer (the policy library shows cards but no drill-down)
- PDF export of audit report
- Google Drive URL input is disabled (UI only)
