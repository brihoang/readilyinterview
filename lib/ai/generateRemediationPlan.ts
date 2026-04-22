import { generateObject } from "ai";
import { z } from "zod";
import { google, MODEL } from "./client";

const RemediationSchema = z.object({
  items: z.array(
    z.object({
      text: z.string().describe("Concrete, actionable task description for a compliance officer to complete"),
      suggestedAssignee: z
        .enum(["Sarah Chen", "Marcus Williams", "Dr. Priya Nair"])
        .describe("Best person to own this task based on role and nature of work"),
      priority: z.enum(["high", "medium", "low"]).describe("Priority based on regulatory severity and financial exposure"),
    })
  ).describe("Remediation tasks ordered high → low priority"),
});

export type RemediationPlan = z.infer<typeof RemediationSchema>;

interface RemediationInput {
  auditName: string;
  framework: string;
  failingItems: Array<{
    questionText: string;
    verdict: string;
    reasoning: string;
    sourceDocumentTitle: string;
  }>;
}

export async function generateRemediationPlan(input: RemediationInput): Promise<RemediationPlan> {
  const { object } = await generateObject({
    model: google(MODEL),
    mode: "tool",
    schema: RemediationSchema,
    system: `You are a healthcare compliance expert creating an operational remediation plan.
Each action item must be a specific, concrete task — not vague guidance. Reference the exact policy area or document where relevant.
Order items high priority first. Assign tasks based on role: clinical/admin policy updates → Sarah Chen or Marcus Williams; executive sign-off or cross-department coordination → Dr. Priya Nair.`,
    prompt: `Generate a prioritized remediation plan for the following audit failures.

AUDIT: ${input.auditName}
FRAMEWORK: ${input.framework}

FAILING COMPLIANCE AREAS:
${input.failingItems.map((item, i) => `${i + 1}. QUESTION: ${item.questionText}
   VERDICT: ${item.verdict}
   ISSUE: ${item.reasoning}
   POLICY DOCUMENT: ${item.sourceDocumentTitle}`).join("\n\n")}

Create one action item per distinct remediation need. Consolidate related items where appropriate.`,
  });

  return object;
}
