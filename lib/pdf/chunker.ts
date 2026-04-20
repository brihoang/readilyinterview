import { nanoid } from "nanoid";
import type { PolicyChunk } from "@/lib/store/types";

const CHUNK_SIZE = 800; // approximate tokens (~4 chars/token = 3200 chars)

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractSectionTitle(para: string): string {
  const flat = para.replace(/\s+/g, " ").trim();

  // Policy header block: "Policy: X Title: Foo Department: Bar" → "Foo"
  const titleField = flat.match(/\bTitle:\s*([^:]+?)(?:\s+(?:Department|Section|Division|Program):|$)/i);
  if (titleField) return titleField[1].trim().slice(0, 80);

  // Roman numeral or lettered heading with colon: "I. Claim Form: ..." → "I. Claim Form"
  // or without colon: "I. PURPOSE" → "I. PURPOSE"
  const romanLabel = flat.match(/^([IVX]+\.\s+[^:.]{2,40})(?:[:.]\s|$)/);
  if (romanLabel) return romanLabel[1].trim();

  // All-caps heading, return as-is (already short from the regex constraint)
  if (/^[A-Z][A-Z\s\d.,:-]{5,}$/.test(flat)) return flat.slice(0, 60);

  // Fallback: first phrase up to colon/comma or 60 chars
  const firstPhrase = flat.split(/[,;]/)[0];
  return firstPhrase.slice(0, 60).trim();
}

export function chunkText(text: string, documentId: string): PolicyChunk[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: PolicyChunk[] = [];
  let currentChunk = "";
  let currentTokens = 0;
  let chunkIndex = 0;
  let sectionTitle = "";

  for (const para of paragraphs) {
    const isHeading =
      // All-caps line (headings like "PURPOSE", "SCOPE AND APPLICABILITY")
      /^[A-Z][A-Z\s\d.,:-]{5,}$/.test(para) ||
      // Roman numeral sections: "I. PURPOSE", "II. SCOPE"
      /^[IVX]+\.\s+[A-Z]/.test(para) ||
      // Policy document title block: "Title: Foo Bar Department: ..."
      /^Title:\s+\S/.test(para) ||
      // Known section keywords — only when the paragraph IS the heading (short)
      /^(SECTION|POLICY|PURPOSE|SCOPE|PROCEDURE|DEFINITIONS?|REFERENCES?|OVERVIEW|BACKGROUND|RESPONSIBILITIES|GUIDELINES?|STANDARDS?|REQUIREMENTS?|INTRODUCTION|APPENDIX)\b.{0,35}$/i.test(para) ||
      // Short title-case line with no sentence punctuation (≤ 8 words)
      (para.length <= 60 &&
        !/[.?!;]$/.test(para) &&
        /^[A-Z]/.test(para) &&
        para.split(/\s+/).length <= 8 &&
        para.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).length >=
          Math.ceil(para.split(/\s+/).length * 0.6));

    if (isHeading) {
      sectionTitle = extractSectionTitle(para);
    }

    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > CHUNK_SIZE && currentChunk) {
      chunks.push({
        id: nanoid(),
        documentId,
        sectionTitle,
        text: currentChunk.trim(),
        chunkIndex: chunkIndex++,
      });
      currentChunk = para;
      currentTokens = paraTokens;
    } else {
      currentChunk += (currentChunk ? "\n\n" : "") + para;
      currentTokens += paraTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      id: nanoid(),
      documentId,
      sectionTitle,
      text: currentChunk.trim(),
      chunkIndex: chunkIndex,
    });
  }

  return chunks;
}
