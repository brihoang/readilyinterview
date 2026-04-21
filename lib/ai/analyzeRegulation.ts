import { generateObject } from "ai";
import { z } from "zod";
import { google, MODEL } from "./client";
import { retrieveTopChunks } from "@/lib/retrieval/keywordSearch";
import type { FederalDocument, PolicyChunk, PolicyRecommendation } from "@/lib/store/types";

const RegulationAnalysisSchema = z.object({
  summary: z
    .string()
    .describe(
      "2-3 sentence plain-English summary of what this regulation requires of healthcare organizations.",
    ),
  impactLevel: z
    .enum(["high", "medium", "low"])
    .describe("Overall compliance burden this regulation imposes."),
  effectiveDate: z
    .string()
    .optional()
    .describe(
      "Expected effective or compliance date if mentioned, ISO format YYYY-MM-DD. Omit if not found.",
    ),
  gaps: z
    .array(
      z.object({
        requirement: z
          .string()
          .describe("A specific, concrete thing this regulation requires."),
        severity: z.enum(["critical", "moderate", "low"]),
        currentCoverage: z
          .enum(["none", "partial", "adequate"])
          .describe(
            "How well the provided existing policy excerpts cover this requirement.",
          ),
        relevantPolicyTitle: z
          .string()
          .optional()
          .describe("Title of the best matching existing policy, if any."),
        relevantPolicySection: z
          .string()
          .optional()
          .describe("Section title of the matching chunk, if any."),
        suggestedAction: z
          .string()
          .describe(
            "Specific action to take — e.g. 'Add a breach notification timeline clause to the HIPAA Privacy Policy'.",
          ),
      }),
    )
    .min(1)
    .max(8)
    .describe("List of specific compliance gaps identified."),
});

export async function analyzeRegulation(
  doc: FederalDocument,
  allChunks: PolicyChunk[],
): Promise<PolicyRecommendation> {
  const query = `${doc.title} ${doc.abstract.slice(0, 3000)}`;
  const relevantChunks = retrieveTopChunks(query, allChunks, 8);

  const policyContext =
    relevantChunks.length > 0
      ? relevantChunks
          .map((c, i) => `[Policy ${i + 1}: ${c.sectionTitle}]\n${c.text}`)
          .join("\n\n---\n\n")
      : "No existing policy documents found.";

  const { object } = await generateObject({
    model: google(MODEL),
    mode: "tool",
    schema: RegulationAnalysisSchema,
    system: `You are a healthcare compliance policy analyst. Your job is to analyze a proposed or final federal regulation and identify gaps between what the regulation requires and what an organization's existing policies already cover.

For each gap you identify:
- Be specific about what the regulation requires
- Judge coverage honestly based only on the policy excerpts provided
- Suggest a concrete, actionable step to close the gap
- Prioritize gaps by severity: "critical" means non-compliance risk, "moderate" means partial risk, "low" means minor or procedural

Focus on requirements that healthcare organizations must implement internally (policies, procedures, training, documentation). Do not flag things outside the organization's control.`,
    prompt: `PROPOSED/FINAL REGULATION:
Title: ${doc.title}
Type: ${doc.type}
Published: ${doc.publicationDate}
Agency: ${doc.agencies.join(", ")}

ABSTRACT:
${doc.abstract}

EXISTING POLICY EXCERPTS (evaluate coverage against these):
${policyContext}`,
  });

  return {
    documentId: doc.id,
    summary: object.summary,
    impactLevel: object.impactLevel,
    effectiveDate: object.effectiveDate,
    gaps: object.gaps,
    analyzedAt: new Date().toISOString(),
  };
}
