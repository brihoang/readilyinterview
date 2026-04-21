import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await store.ensureActionItemsLoaded();
  const item = store.getActionItem(params.id);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await store.updateActionItem(params.id, body);

  if (body.status === "completed" && item.status !== "completed") {
    await store.ensureActivitiesLoaded();
    await store.addActivity({
      action: "action_item_completed",
      actor: body.completedBy ?? "Unknown",
      auditId: item.auditId,
      auditName: item.auditName,
      details: item.text.length > 80 ? item.text.slice(0, 80) + "…" : item.text,
    });
  }

  return NextResponse.json({ item: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await store.ensureActionItemsLoaded();
  const deleted = await store.deleteActionItem(params.id);
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
