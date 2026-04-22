import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";
import { generateRemediationPlan } from "@/lib/ai/generateRemediationPlan";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAuditsLoaded();
  await ensureSeeded();

  const audit = store.getAudit(params.id);
  if (!audit)
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const { actor } = await req.json().catch(() => ({ actor: "Unknown" }));

  const failingItems = audit.questions
    .filter((q) => {
      const r = audit.results[q.id];
      return r && (r.verdict === "fail" || r.verdict === "partial") && !r.markedCompliant;
    })
    .map((q) => {
      const r = audit.results[q.id];
      return {
        questionText: q.text,
        verdict: r.verdict,
        reasoning: r.reasoning,
        sourceDocumentTitle: r.sourceDocumentTitle,
      };
    });

  if (failingItems.length === 0) {
    return NextResponse.json(
      { error: "No unresolved failures to remediate" },
      { status: 400 },
    );
  }

  const plan = await generateRemediationPlan({
    auditName: audit.name,
    framework: audit.framework,
    failingItems,
  });

  await store.ensureActionItemsLoaded();
  const createdItems = await Promise.all(
    plan.items.map((item) =>
      store.createActionItem({
        auditId: audit.id,
        auditName: audit.name,
        text: item.text,
        createdBy: actor,
        assignedTo: item.suggestedAssignee,
      }),
    ),
  );

  await store.ensureActivitiesLoaded();
  await store.addActivity({
    action: "action_item_created",
    actor,
    auditId: audit.id,
    auditName: audit.name,
    details: `Generated ${createdItems.length} remediation items via AI`,
  });

  return NextResponse.json({ items: createdItems });
}
