import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";
import { evaluateQuestion } from "@/lib/ai/evaluateQuestion";
import { retrieveTopChunks } from "@/lib/retrieval/keywordSearch";

export const maxDuration = 300; // seconds — requires Vercel Pro; on Hobby capped at 10s

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAuditsLoaded();
  await ensureSeeded();

  const audit = store.getAudit(params.id);
  if (!audit)
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const runMode: "all" | "failed-only" = body.runMode ?? "all";

  const questionsToRun =
    runMode === "failed-only"
      ? audit.questions.filter((q) => {
          const r = audit.results[q.id];
          return !r || r.verdict === "fail" || r.verdict === "partial";
        })
      : audit.questions;

  if (questionsToRun.length === 0) {
    return NextResponse.json(
      { error: "No questions to evaluate" },
      { status: 400 },
    );
  }

  await store.updateAudit(params.id, {
    status: "evaluating",
    iterationCount: audit.iterationCount + 1,
    runMode,
  });

  const allChunks = store.getAllChunks();
  const docTitleMap: Record<string, string> = {};
  for (const doc of store.getPolicyDocuments()) {
    docTitleMap[doc.id] = doc.title;
  }

  // Stream results back as NDJSON (one JSON line per question result)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (const question of questionsToRun) {
          const relevantChunks = retrieveTopChunks(question.text, allChunks, 6);
          const result = await evaluateQuestion(
            question,
            relevantChunks,
            docTitleMap,
          );

          // Persist result immediately
          const currentAudit = store.getAudit(params.id)!;
          await store.updateAudit(params.id, {
            results: { ...currentAudit.results, [question.id]: result },
          });

          controller.enqueue(encoder.encode(JSON.stringify(result) + "\n"));
        }

        // Mark complete
        await store.updateAudit(params.id, { status: "complete" });
        controller.enqueue(
          encoder.encode(JSON.stringify({ done: true }) + "\n"),
        );
        controller.close();
      } catch (err) {
        console.error("Evaluation error:", err);
        await store.updateAudit(params.id, { status: "complete" });
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: String(err) }) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
