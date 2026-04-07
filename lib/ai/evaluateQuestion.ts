import { generateObject } from "ai";
import { z } from "zod";
import { google, MODEL } from "./client";
import type { Question, PolicyChunk, QuestionResult } from "@/lib/store/types";

const EvalSchema = z.object({
  verdict: z.enum(["pass", "fail", "partial"]),
  confidence: z.number().min(0).max(1),
  evidenceText: z
    .string()
    .describe(
      "Direct quote from the policy that supports the verdict. Empty string if no relevant policy found.",
    ),
  reasoning: z
    .string()
    .describe("1-3 sentences explaining why this verdict was reached."),
});

export async function evaluateQuestion(
  question: Question,
  relevantChunks: PolicyChunk[],
  documentTitleMap: Record<string, string>,
): Promise<QuestionResult> {
  const policyContext =
    relevantChunks.length > 0
      ? relevantChunks
          .map((c, i) => {
            const docTitle = documentTitleMap[c.documentId] ?? c.documentId;
            return `[Policy ${i + 1}: ${docTitle} — ${c.sectionTitle}]\n${c.text}`;
          })
          .join("\n\n---\n\n")
      : "No relevant policy documents found.";

  const { object } = await generateObject({
    model: google(MODEL),
    schema: EvalSchema,
    system: `You are a strict healthcare compliance auditor reviewing an organization's policies.
Your job: determine whether the organization's policies satisfy a specific audit question.

Verdict rules:
- "pass": The policies clearly and explicitly address the requirement
- "partial": The policies partially address it but have gaps or ambiguities
- "fail": The policies do not address the requirement, or actively contradict it

If you found a relevant policy passage, quote it EXACTLY (do not paraphrase) in evidenceText.
If no relevant policy was found, set evidenceText to empty string and verdict to "fail".`,
    prompt: `AUDIT QUESTION (${question.category}):\n${question.text}\n\nRELEVANT POLICY EXCERPTS:\n${policyContext}`,
  });

  // Find which chunk contained the evidence
  let matchedChunk: PolicyChunk | undefined;
  if (object.evidenceText && relevantChunks.length > 0) {
    matchedChunk = relevantChunks.find((c) =>
      c.text
        .toLowerCase()
        .includes(object.evidenceText.slice(0, 50).toLowerCase()),
    ) ?? relevantChunks[0];
  } else if (relevantChunks.length > 0) {
    matchedChunk = relevantChunks[0];
  }

  const sourceDocumentId = matchedChunk?.documentId ?? "";
  const sourceDocumentTitle = sourceDocumentId
    ? (documentTitleMap[sourceDocumentId] ?? sourceDocumentId)
    : "";
  const sourceSectionTitle = matchedChunk?.sectionTitle ?? "";

  return {
    questionId: question.id,
    verdict: object.verdict,
    confidence: object.confidence,
    evidenceText: object.evidenceText,
    sourceDocumentId,
    sourceDocumentTitle,
    sourceSectionTitle,
    reasoning: object.reasoning,
    evaluatedAt: new Date().toISOString(),
  };
}
