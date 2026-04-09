import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function GET() {
  await store.ensureAuditsLoaded();
  return NextResponse.json({ audits: store.getAuditSummaries() });
}

export async function POST(req: NextRequest) {
  await store.ensureAuditsLoaded();
  const body = await req.json();
  const { name, organization, framework, targetDate, notes } = body;

  if (!name || !organization || !framework) {
    return NextResponse.json(
      { error: "name, organization, and framework are required" },
      { status: 400 },
    );
  }

  const audit = await store.createAudit({
    name,
    organization,
    framework,
    targetDate: targetDate ?? "",
    notes: notes ?? "",
  });
  return NextResponse.json({ audit }, { status: 201 });
}
