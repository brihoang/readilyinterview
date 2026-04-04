import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

// Update questions after user edits them in the review step
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const audit = store.getAudit(params.id);
  if (!audit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { questions } = await req.json();
  const updated = store.updateAudit(params.id, { questions, status: "ready" });
  return NextResponse.json({ audit: updated });
}
