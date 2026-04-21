import { generateObject } from "ai";
import { z } from "zod";
import { google, MODEL } from "./client";
import type { PolicyDocument } from "@/lib/store/types";

const AnalysisSchema = z.object({
  fragile: z.boolean(),
  severity: z.enum(["high", "medium", "low", "none"]),
  summary: z.string().describe("One sentence overall assessment of the policy's compliance strength."),
  issues: z.array(
    z.object({
      type: z.enum(["missing_coverage", "vague_language", "outdated", "contradiction"]),
      description: z.string().describe("Specific, actionable description of the issue."),
      section: z.string().describe("Section or chunk title where the issue is found. Use 'General' if document-wide."),
    }),
  ),
});

export type PolicyAnalysis = z.infer<typeof AnalysisSchema>;

export async function analyzePolicy(doc: PolicyDocument): Promise<PolicyAnalysis> {
  const policyText = doc.chunks
    .map((c) => `[${c.sectionTitle}]\n${c.text}`)
    .join("\n\n---\n\n");

  const { object } = await generateObject({
    model: google(MODEL),
    mode: "tool",
    schema: AnalysisSchema,
    system: `You are a senior healthcare compliance expert specializing in HIPAA, CMS Conditions of Participation, and Joint Commission standards.
Your task: analyze a policy document for weaknesses that would cause it to fail a compliance audit.

Severity rules:
- "high": Missing required elements, contradictions, or critical gaps that would certainly fail an audit
- "medium": Vague language, incomplete procedures, or missing specifics that create audit risk
- "low": Minor wording issues or areas that could be strengthened but are unlikely to fail
- "none": Policy appears complete and compliant — no significant issues found

Only flag real, specific issues. Do not invent problems. If the policy is solid, say so with severity "none" and fragile: false.`,
    prompt: `Analyze this healthcare policy document for compliance gaps and weaknesses.

DOCUMENT TITLE: ${doc.title}
CATEGORY: ${doc.category}
FOLDER: ${doc.folder}

POLICY CONTENT:
${policyText}`,
  });

  return object;
}
