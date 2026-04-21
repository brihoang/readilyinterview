import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";
import { generatePolicyFix } from "@/lib/ai/generatePolicyFix";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAnticipatorLoaded();
  await ensureSeeded();

  const doc = store.getFederalDocument(params.id);
  if (!doc) {
    return NextResponse.json({ error: "Regulation not found" }, { status: 404 });
  }

  const { requirement, suggestedAction, relevantPolicyTitle, relevantPolicySection } =
    await req.json();

  // Find the policy document by title
  const policyDoc = store
    .getPolicyDocuments()
    .find((d) => d.title === relevantPolicyTitle);

  if (!policyDoc) {
    return NextResponse.json({ error: "Policy document not found" }, { status: 404 });
  }

  const chunk = relevantPolicySection
    ? policyDoc.chunks.find((c) => c.sectionTitle === relevantPolicySection)
    : policyDoc.chunks[0];

  const fix = await generatePolicyFix({
    docTitle: policyDoc.title,
    issueType: "Upcoming Regulatory Requirement",
    issueDescription: `Requirement from proposed/final regulation "${doc.title}": ${requirement}. Suggested action: ${suggestedAction}`,
    sectionTitle: chunk?.sectionTitle ?? "Policy",
    sectionText: chunk?.text ?? "",
  });

  return NextResponse.json({
    ...fix,
    originalText: chunk?.text ?? "",
    docId: policyDoc.id,
    sectionTitle: chunk?.sectionTitle ?? "",
  });
}
