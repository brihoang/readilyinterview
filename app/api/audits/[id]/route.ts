import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const audit = store.getAudit(params.id);
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ audit });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const audit = store.getAudit(params.id);
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  const updated = store.updateAudit(params.id, body);
  return NextResponse.json({ audit: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  store.deleteAudit(params.id);
  return NextResponse.json({ ok: true });
}
