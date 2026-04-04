import { generateObject } from "ai";
import { z } from "zod";
import { google, MODEL } from "./client";
import { nanoid } from "nanoid";
import type { Question } from "@/lib/store/types";

const QuestionSchema = z.object({
  questions: z.array(
    z.object({
      category: z
        .string()
        .describe(
          "Compliance category, e.g. 'Access Control', 'Privacy', 'Security'",
        ),
      text: z
        .string()
        .describe("The full question text as written in the questionnaire"),
      source: z
        .string()
        .describe("Section reference, e.g. 'Section 3.2' or 'Q12'"),
    }),
  ),
});

export async function extractQuestionsFromText(
  pdfText: string,
  auditId: string,
): Promise<Question[]> {
  const { object } = await generateObject({
    model: google(MODEL),
    schema: QuestionSchema,
    system: `You are a healthcare compliance analyst. Extract every audit question or compliance criterion from the questionnaire document provided.
Each item should represent a distinct thing that must be verified or confirmed.
Be thorough — do not skip any questions, sub-questions, or checklist items.
Infer a compliance category for each question (e.g. Privacy, Security, Access Control, Training, Documentation, Incident Response, etc.).
Identify the source location (section number, question number, or item label) from the document.`,
    prompt: `Extract all audit questions and compliance criteria from this questionnaire:\n\n${pdfText.slice(0, 50000)}`,
  });

  return object.questions.map((q, i) => ({
    id: nanoid(),
    auditId,
    orderIndex: i,
    category: q.category,
    text: q.text,
    source: q.source,
    isEdited: false,
  }));
}
