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
UPSTASH_REDIS_REST_URL=your_url_here    # optional — enables persistence across cold starts
UPSTASH_REDIS_REST_TOKEN=your_token_here
```

Get a Gemini key at https://aistudio.google.com/apikey

## Tech stack

- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS 3 + shadcn/ui (Radix primitives) + Lucide icons
- **AI**: Gemini 2.0 Flash via `@ai-sdk/google` (Vercel AI SDK)
- **State (server)**: In-memory singleton (`lib/store/index.ts`) + Upstash Redis persistence
- **State (client)**: Local React state — no Zustand
- **PDF parsing**: `pdf-parse` via `require("pdf-parse/lib/pdf-parse")` (sub-path avoids test file side effect)
- **Retrieval**: TF-IDF keyword scoring (`lib/retrieval/keywordSearch.ts`) — no embeddings/vector DB

## Demo users

Three hardcoded users switchable from the user menu (top-right):

| Name | Role | Notes |
|------|------|-------|
| Sarah Chen | Compliance Officer | Default user |
| Marcus Williams | Compliance Officer | |
| Dr. Priya Nair | Administrator | Sees Gap Detector + Activity Log in sidebar |

## Key files

| File | Purpose |
|------|---------|
| `lib/store/types.ts` | All TypeScript interfaces — start here |
| `lib/store/index.ts` | In-memory store singleton with Redis persistence (STORE_VERSION must be bumped when adding new entity types) |
| `lib/seed/index.ts` | Loads PDFs from `policies/` into the store on first request |
| `lib/ai/extractQuestions.ts` | Gemini call to extract questions from questionnaire PDF |
| `lib/ai/evaluateQuestion.ts` | Gemini call to evaluate one question against policy chunks |
| `lib/ai/analyzePolicy.ts` | Gemini call to detect gaps in a policy document |
| `lib/ai/generatePolicyFix.ts` | Gemini call to suggest improved policy text for a gap |
| `app/api/audits/[id]/evaluate/route.ts` | Streaming NDJSON route — evaluates all questions, streams results back |
| `app/api/admin/gap-analysis/route.ts` | Streaming NDJSON route — analyzes policy documents for gaps |
| `components/audit/PrepWorkspace.tsx` | Core audit state machine (idle→extracting→review→ready→evaluating→complete) |

## Audit workflow (state machine)

```
idle → (upload PDF) → extracting → review → ready → evaluating → complete → archived
                                                             ↑          |
                                                             └──────────┘ (re-run)
```

- **idle**: Show empty state + "Upload Questionnaire" button
- **extracting**: PDF uploaded, AI extracting questions
- **review**: User reviews/edits extracted questions, confirms
- **ready**: Questions confirmed, show "Run Audit" button
- **evaluating**: AI evaluating each question, streaming results live via NDJSON. Results are persisted to the store per-question as they arrive — navigating away and back mid-evaluation is safe.
- **complete**: Show results — pass/fail per question with evidence, remediation todo list
- **archived**: Audit signed off; read-only view

## Policy library

373 PDF files in `policies/` organized in 10 folders (AA, CMC, DD, EE, FF, GA, GG, HH, MA, PA). Parsed and chunked into ~800-token segments at server startup via `ensureSeeded()`. Call `ensureSeeded()` at the top of every API route that needs policy data — it is idempotent.

## Store — entity types

All entities live in `lib/store/index.ts` as private `Map`s on the `InMemoryStore` class, persisted to Redis via `kv*` helpers. When adding a new entity:
1. Define interface in `lib/store/types.ts`
2. Add `private Map` + `loaded` flag to the class
3. Add `kvWrite*` / `kvDelete*` / `kvLoad*` Redis helpers
4. Add `ensureLoaded()` + CRUD methods
5. Bump `STORE_VERSION` (forces singleton recreation on hot reload)

Current entities: `Audit`, `PolicyDocument`, `ActivityEntry`, `ActionItem`, plus Policy Anticipator types (`FederalDocument`, `PolicyRecommendation`).

## AI calls

All use `generateObject` from Vercel AI SDK with Zod schemas (no freeform parsing).

- **Extraction**: Single call, full PDF text → `Question[]`
- **Evaluation**: One call per question, top-6 retrieved TF-IDF chunks → verdict + evidence
- **Gap analysis**: One call per policy document → `{ fragile, severity, issues[] }`
- **Policy fix**: One call per issue → `{ improvedText, changesSummary }`

## Features

### Core audit flow
Questionnaire PDF upload → AI question extraction → user review/edit → AI evaluation → pass/fail results with evidence and estimated financial exposure. Re-run support for failed-only questions. Sign-off/archive.

### Policy patches
From a failing question, the AI can suggest a policy text fix. The user edits the suggestion in a textarea, then accepts it. Patches are applied to the in-memory policy chunks and persisted to Redis so they survive cold starts.

### Outstanding Tasks (`/tasks`)
Shows all non-archived audits where the user is owner or stakeholder, plus open action items assigned to the current user.

### Action Items (`/action-items`)
Free-form operational tasks that live independently of audits (or can be linked to one). Assignable to any demo user. Tabs: My Action Items (default), Open, Completed, All. Also visible per-audit in the "Action Items" tab.

### Analytics (`/analytics`)
Cross-audit dashboard: outstanding issue count, open/closed financial exposure, questions resolved in last 7/30 days, per-audit breakdown table.

### Admin: Gap Detector (`/admin/gap-detector`)
Admin-only. Select a policy folder (or all), run AI analysis across every document, see severity-rated gaps per document. Per-issue "Generate Fix" button → editable textarea → Apply Patch (uses same patch infrastructure as audit patches).

### Admin: Activity Log (`/admin/activity`)
Append-only log of all major actions with actor, timestamp, and context. Persisted to Redis.

## What's not built yet

- Confetti animation on the all-pass celebration modal
- Compliance score gauge/visual on the audit detail header
- Policy document full-text viewer (policy library shows cards but no drill-down)
- PDF export of audit report
- Google Drive URL input is disabled (UI only)
