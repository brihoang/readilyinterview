import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(req: NextRequest) {
  await store.ensureActionItemsLoaded();
  const auditId = req.nextUrl.searchParams.get("auditId") ?? undefined;
  const items = store.getActionItems(auditId);
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  await store.ensureActionItemsLoaded();
  const body = await req.json();
  const { auditId, auditName, text, createdBy, assignedTo } = body;

  if (!text || !createdBy || !assignedTo) {
    return NextResponse.json({ error: "text, createdBy, and assignedTo are required" }, { status: 400 });
  }

  const item = await store.createActionItem({ auditId, auditName, text, createdBy, assignedTo });

  await store.ensureActivitiesLoaded();
  await store.addActivity({
    action: "action_item_created",
    actor: createdBy,
    auditId,
    auditName,
    details: text.length > 80 ? text.slice(0, 80) + "…" : text,
  });

  return NextResponse.json({ item }, { status: 201 });
}
