import { generateObject } from "ai";
import { z } from "zod";
import { google, MODEL } from "./client";

const FixSchema = z.object({
  improvedText: z.string().describe("Full replacement text for the policy section. Complete, ready-to-use policy language."),
  changesSummary: z.string().describe("1-2 sentences explaining what was changed and why it improves compliance."),
});

export type PolicyFix = z.infer<typeof FixSchema>;

interface FixInput {
  docTitle: string;
  issueType: string;
  issueDescription: string;
  sectionTitle: string;
  sectionText: string;
}

export async function generatePolicyFix(input: FixInput): Promise<PolicyFix> {
  const { object } = await generateObject({
    model: google(MODEL),
    mode: "tool",
    schema: FixSchema,
    system: `You are a healthcare compliance policy writer. You write clear, specific, audit-ready policy language that satisfies HIPAA, CMS, and Joint Commission requirements.
Write in formal policy document style. Be specific about roles, timeframes, and procedures. Do not include preamble or commentary — output only the improved policy text itself.`,
    prompt: `Rewrite the following policy section to fix a compliance issue.

DOCUMENT: ${input.docTitle}
SECTION: ${input.sectionTitle}
ISSUE TYPE: ${input.issueType}
ISSUE: ${input.issueDescription}

CURRENT SECTION TEXT:
${input.sectionText || "(section text not available — write new policy language for this area)"}

Write improved policy text that directly addresses the issue.`,
  });

  return object;
}
