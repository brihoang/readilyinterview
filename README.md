# Readily — AI Compliance Audit Platform

A demo application for automating healthcare compliance audit preparation. Upload an audit questionnaire PDF, let AI extract and evaluate each question against your policy library, and get pass/fail verdicts with exact policy citations.

## Features

- **Policy Library** — 373 real policy documents organized across 10 compliance categories, parsed and indexed at startup
- **Audit Management** — Create audits with framework (HIPAA, CMS, Joint Commission, etc.), organization, and target date
- **AI Question Extraction** — Upload a questionnaire PDF; Gemini extracts all compliance questions into structured data
- **Question Review** — Edit, add, or remove extracted questions before running
- **Live Evaluation** — AI evaluates each question against policy chunks in real time, streaming results as they complete
- **Evidence Citations** — Every verdict includes the exact quoted policy passage and its source document
- **Remediation Workflow** — Failed questions become a todo list; mark items compliant as you update policies
- **Iterative Re-runs** — Re-run the full suite or only previously failed questions

## Getting Started

### Prerequisites

- Node.js 18+
- A Google AI Studio API key — [get one here](https://aistudio.google.com/apikey)

### Setup

```bash
# Install dependencies
npm install

# Add your API key
echo "GOOGLE_GENERATIVE_AI_API_KEY=your_key_here" > .env.local

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Tech Stack

| Layer       | Choice                                              |
| ----------- | --------------------------------------------------- |
| Framework   | Next.js 14 (App Router)                             |
| UI          | Tailwind CSS + shadcn/ui + Lucide                   |
| AI          | Gemini 2.0 Flash via Vercel AI SDK                  |
| PDF Parsing | pdf-parse                                           |
| Retrieval   | TF-IDF keyword search                               |
| State       | In-memory singleton (server) + React state (client) |

## Project Structure

```
app/
  audits/             # Audit list + detail pages
  policies/           # Policy library page
  api/                # REST + streaming API routes
components/
  audit/              # PrepWorkspace state machine + evaluation UI
  layout/             # AppShell, Sidebar, UserBadge
  ui/                 # shadcn/ui primitives
lib/
  ai/                 # Gemini calls (extract + evaluate)
  pdf/                # Parser + chunker
  retrieval/          # TF-IDF keyword search
  seed/               # Loads policy PDFs on startup
  store/              # In-memory store + TypeScript types
policies/             # Source policy PDF documents (10 folders, 373 files)
```

## How It Works

1. **Startup** — All PDFs in `policies/` are parsed, chunked into ~800-token segments, and stored in memory
2. **Upload** — Questionnaire PDF is parsed server-side and sent to Gemini for question extraction
3. **Evaluation** — For each question, the top-6 most relevant policy chunks are retrieved via TF-IDF scoring, then passed to Gemini with the question for a structured verdict
4. **Streaming** — Results stream back to the client as NDJSON, updating the UI question-by-question in real time

## Production Considerations

This demo uses hardcoded state and in-memory storage to keep the architecture simple. Below is what a real, multi-user production version of this product would require.

### Authentication & Authorization

The current app hardcodes a single user. A production system needs full identity and access management:

- **Auth provider**: Auth0, Clerk, or Supabase Auth for session management, MFA, and SSO (SAML/OIDC for enterprise healthcare orgs)
- **Role system**: At minimum — Admin, Compliance Officer, Policy Owner, Department Head, and read-only Auditor
  - Admins manage org-wide settings, users, and roles
  - Compliance Officers own audits end-to-end
  - Policy Owners are assigned to specific policy domains and can only resolve items within their scope
  - Department Heads receive delegated questions and see their personal action queue
- **Row-level permissions**: Org A's compliance officers cannot see Org B's audits (multi-tenant isolation)
- **Immutable audit trail**: Every action — mark compliant, re-run, question edit, delegation — logged with user ID and timestamp. This is itself a compliance requirement in healthcare.

### Persistent Backend & Data Layer

The in-memory singleton resets on every server restart and cannot support concurrent users:

- **Database**: PostgreSQL (via Prisma or Supabase) with a multi-tenant schema: `orgs → users → audits → questions → results`
- **API layer**: GraphQL (Apollo or URQL) or tRPC replaces the current ad-hoc REST routes. The outstanding tasks view in particular benefits from a structured query — `outstandingQuestions(userId, orgId, orderBy: urgency)` — where the server computes what's relevant per user and paginates. Completed items are paginated separately and not loaded by default.
- **Background jobs**: Long-running AI evaluation (potentially hundreds of questions) should move off the HTTP request/response cycle into a job queue (BullMQ, Inngest, or Trigger.dev). The client polls or subscribes for progress rather than holding a streaming connection open indefinitely.

### Question Delegation & Assignment

When a compliance officer encounters a question outside their expertise, they need to hand it off:

- Assign individual questions to a specific stakeholder (e.g. "IT Security owns all 45 CFR §164.312 questions")
- Assignees see their questions in a personal action queue, receive notifications, and can mark items resolved
- Questions can be reassigned or escalated up the chain
- Per-question comment threads for async collaboration — discussion lives on the record, not in Slack

This connects directly to the stakeholder model on an audit: stakeholders get visibility; assignees get action items.

### Notifications & Urgency

The demo has a hardcoded notification bar. A real system needs urgency that's computed, not authored:

- **Notification delivery**: Email (Resend or SendGrid) + in-app (WebSockets or SSE) + configurable digest (daily/weekly)
- **Default sort order** for outstanding tasks weighted by:
  - Proximity to audit date (days remaining)
  - Gap severity (fail outranks partial)
  - Financial exposure (see below)
- **Configurable reminders**: 30 days out, 14 days out, 7 days out, 1 day out — per audit, per org

### Compliance Risk & Financial Impact

Not all compliance gaps are equal. A question about documentation formatting is not the same as a question about patient data encryption:

- Tag each question with the specific regulatory citation it maps to (e.g. 45 CFR §164.312(a)(1))
- Map citations to published fine tiers — the HHS OCR penalty structure ranges from $100 to $50,000 per violation, up to $1.9M per year per category
- AI estimates financial exposure per failed question during evaluation
- Remediation todo list sorted by estimated fine exposure descending by default ("fix the $75k issue before the $500 one")
- Audit header shows aggregate risk: "Estimated exposure if audited today: $2.3M"
- Re-run shows the delta: "Resolved $1.1M in estimated exposure since last run"
- AI can optimize remediation order to minimize total fines given limited time before the audit date

### Additional Ideas

Beyond the above, a production version could include:

- **Proactive policy gap detection**: AI periodically scans the policy library and flags policies that are outdated, contradictory, or missing coverage for known regulatory requirements — no questionnaire needed to surface risks
- **Regulatory change monitoring**: Watch the Federal Register and CMS rule publications; flag audits whose questions are affected by new or updated rules
- **Policy version control**: Track every version of every policy document, see which audit run used which version, support rollback and diff views
- **Audit report export**: Generate a formatted PDF report — compliance score, evidence citations, remediation history — suitable for presenting to an external auditor or board
- **Real-time collaboration**: Multiple users working the same audit simultaneously with presence indicators and optimistic updates
- **Audit templates**: Pre-built questionnaire templates for HIPAA, CMS Conditions of Participation, Joint Commission, NCQA — start an audit with a single click, no PDF upload required
- **Analytics dashboard**: Compliance score trends over time, most commonly failed question categories, average remediation cycle time, org-wide risk heat map
- **Integrations**: Push failed questions as tickets to JIRA, Linear, or ServiceNow; pull policy documents from SharePoint, Google Drive, or Box; connect to healthcare IAM providers for SSO
- **Multi-model evaluation**: Run evaluation across multiple LLMs and surface confidence variance as a signal — high disagreement between models flags a question for mandatory human review before a verdict is recorded
- **AI-generated remediation drafts**: When a question fails, AI drafts the specific policy language that would address the gap, ready for a policy owner to review, edit, and formally adopt
