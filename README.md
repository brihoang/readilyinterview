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

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| UI | Tailwind CSS + shadcn/ui + Lucide |
| AI | Gemini 2.0 Flash via Vercel AI SDK |
| PDF Parsing | pdf-parse |
| Retrieval | TF-IDF keyword search |
| State | In-memory singleton (server) + React state (client) |

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
