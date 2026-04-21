import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";

export async function POST(req: NextRequest) {
  const { docId, originalText, patchedText, reasoning, acceptedBy } = await req.json();

  const doc = store.getPolicyDocument(docId);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  await store.patchPolicyDocument(docId, {
    originalText,
    patchedText,
    reasoning,
    acceptedBy: acceptedBy ?? "Unknown",
  });

  await store.addActivity({
    action: "policy_patched",
    actor: acceptedBy ?? "Unknown",
    details: `Patched policy via Gap Detector: ${doc.title}`,
  });

  return NextResponse.json({ success: true });
}
