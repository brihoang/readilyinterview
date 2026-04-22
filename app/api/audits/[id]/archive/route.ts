import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAuditsLoaded();

  const audit = store.getAudit(params.id);
  if (!audit)
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const { archivedBy } = await req.json();

  const updated = await store.updateAudit(params.id, {
    status: "archived",
    archivedBy,
    archivedAt: new Date().toISOString(),
  });

  await store.ensureActivitiesLoaded();
  await store.addActivity({
    action: "audit_signed_off",
    actor: archivedBy ?? "Unknown",
    auditId: audit.id,
    auditName: audit.name,
    details: `Signed off "${audit.name}"`,
  });

  return NextResponse.json({ success: true, audit: updated });
}
