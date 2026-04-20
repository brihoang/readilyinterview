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

  const { questionId, originalText, patchedText, reasoning, acceptedBy } =
    await req.json();

  const result = audit.results[questionId];
  if (!result)
    return NextResponse.json({ error: "Result not found" }, { status: 404 });

  const sourceDocumentId = result.sourceDocumentId;

  // Fail verdict with no source doc — no document to patch
  if (!sourceDocumentId) {
    return NextResponse.json(
      { error: "No source document to patch" },
      { status: 400 },
    );
  }

  const updated = store.patchPolicyDocument(sourceDocumentId, {
    originalText,
    patchedText,
    reasoning,
    acceptedBy,
  });

  if (!updated)
    return NextResponse.json(
      { error: "Policy document not found" },
      { status: 404 },
    );

  return NextResponse.json({ success: true, documentId: sourceDocumentId });
}
