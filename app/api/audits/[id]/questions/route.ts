import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

// Update questions after user edits them in the review step
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAuditsLoaded();
  const audit = store.getAudit(params.id);
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { questions, actor } = await req.json();
  const updated = await store.updateAudit(params.id, {
    questions,
    status: "ready",
  });

  await store.addActivity({
    action: "questions_confirmed",
    actor: actor ?? "Unknown",
    auditId: audit.id,
    auditName: audit.name,
    details: `Confirmed ${questions.length} questions`,
  });

  return NextResponse.json({ audit: updated });
}
