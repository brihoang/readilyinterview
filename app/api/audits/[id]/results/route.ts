import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

// Mark a question result as compliant (todo list action)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAuditsLoaded();
  const audit = store.getAudit(params.id);
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { questionId, markedCompliant } = await req.json();
  const existing = audit.results[questionId] ?? {
    questionId,
    verdict: "pending" as const,
    confidence: 0,
    evidenceText: "",
    sourceDocumentId: "",
    sourceDocumentTitle: "",
    sourceSectionTitle: "",
    reasoning: "Not AI-evaluated",
    evaluatedAt: new Date().toISOString(),
  };

  const updated = await store.updateAudit(params.id, {
    results: {
      ...audit.results,
      [questionId]: {
        ...existing,
        markedCompliant,
        markedCompliantAt: markedCompliant
          ? new Date().toISOString()
          : undefined,
        markedCompliantBy: markedCompliant ? "Sarah Chen" : undefined,
      },
    },
  });

  return NextResponse.json({ audit: updated });
}
