import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { generatePolicySuggestion } from "@/lib/ai/generatePolicySuggestion";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAuditsLoaded();

  const audit = store.getAudit(params.id);
  if (!audit)
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const { questionId } = await req.json();
  const result = audit.results[questionId];
  if (!result)
    return NextResponse.json({ error: "Result not found" }, { status: 404 });

  if (result.verdict !== "fail" && result.verdict !== "partial")
    return NextResponse.json(
      { error: "Patches only generated for fail or partial verdicts" },
      { status: 400 },
    );

  const question = audit.questions.find((q) => q.id === questionId);
  if (!question)
    return NextResponse.json({ error: "Question not found" }, { status: 404 });

  console.log("[patch-suggestion] calling Gemini for question", questionId);
  const patch = await generatePolicySuggestion({
    questionText: question.text,
    evidenceText: result.evidenceText,
    sourceDocumentTitle: result.sourceDocumentTitle,
    sourceSectionTitle: result.sourceSectionTitle,
    evaluationReasoning: result.reasoning,
    verdict: result.verdict,
  });

  return NextResponse.json(patch);
}
