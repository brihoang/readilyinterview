import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

// Mark a question result as compliant (todo list action)
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const audit = store.getAudit(params.id);
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { questionId, markedCompliant } = await req.json();
  const existing = audit.results[questionId];
  if (!existing) return NextResponse.json({ error: "Result not found" }, { status: 404 });

  const updated = store.updateAudit(params.id, {
    results: {
      ...audit.results,
      [questionId]: {
        ...existing,
        markedCompliant,
        markedCompliantAt: markedCompliant ? new Date().toISOString() : undefined,
        markedCompliantBy: markedCompliant ? "Sarah Chen" : undefined,
      },
    },
  });

  return NextResponse.json({ audit: updated });
}
