import { generateObject } from "ai";
import { z } from "zod";
import { google, MODEL } from "./client";

const PatchSchema = z.object({
  originalText: z
    .string()
    .describe(
      "The specific existing clause being replaced. Empty string if no existing policy covers this requirement.",
    ),
  patchedText: z
    .string()
    .describe(
      "The new or updated policy language that directly addresses the compliance gap.",
    ),
  reasoning: z
    .string()
    .describe("1-2 sentences explaining what gap this patch closes."),
});

export async function generatePolicySuggestion({
  questionText,
  evidenceText,
  sourceDocumentTitle,
  sourceSectionTitle,
  evaluationReasoning,
  verdict,
}: {
  questionText: string;
  evidenceText: string;
  sourceDocumentTitle: string;
  sourceSectionTitle: string;
  evaluationReasoning: string;
  verdict: "fail" | "partial";
}) {
  const { object } = await generateObject({
    model: google(MODEL),
    schema: PatchSchema,
    system: `You are a healthcare compliance policy writer. Draft a minimal, targeted policy update that closes a specific compliance gap found during an audit.

Rules:
- Use formal, precise healthcare policy language
- Be specific: include timeframes, responsible parties, and documentation requirements where relevant
- Keep the change minimal — only address the identified gap, do not rewrite the entire policy
- If no existing policy was found, draft new standalone policy language
- Output only the policy text itself — no section headers, no preamble`,
    prompt: `AUDIT QUESTION:
${questionText}

EXISTING POLICY (${sourceDocumentTitle}${sourceSectionTitle ? ` — ${sourceSectionTitle}` : ""}):
${evidenceText || "No matching policy found in the library."}

WHY THIS ${verdict === "fail" ? "FAILED" : "PARTIALLY PASSED"}:
${evaluationReasoning}

Draft a targeted policy update. Set originalText to the specific clause being replaced (or empty string if there is no existing coverage). Set patchedText to the new policy language that closes the gap.`,
  });

  return object;
}
