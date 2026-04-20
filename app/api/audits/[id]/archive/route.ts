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

  return NextResponse.json({ success: true, audit: updated });
}
