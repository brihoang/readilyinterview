import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { generatePolicyFix } from "@/lib/ai/generatePolicyFix";

export async function POST(req: NextRequest) {
  const { docId, issueDescription, issueType, section } = await req.json();

  const doc = store.getPolicyDocument(docId);
  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const chunk = doc.chunks.find((c) => c.sectionTitle === section);
  const sectionText = chunk?.text ?? "";

  const fix = await generatePolicyFix({
    docTitle: doc.title,
    issueType,
    issueDescription,
    sectionTitle: section,
    sectionText,
  });

  return NextResponse.json({ ...fix, originalText: sectionText });
}
