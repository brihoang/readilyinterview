import { nanoid } from "nanoid";
import type { PolicyChunk } from "@/lib/store/types";

const CHUNK_SIZE = 800; // approximate tokens (~4 chars/token = 3200 chars)
const OVERLAP = 100; // token overlap between chunks

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function chunkText(text: string, documentId: string): PolicyChunk[] {
  // Split on double newlines (paragraphs/sections) first
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: PolicyChunk[] = [];
  let currentChunk = "";
  let currentTokens = 0;
  let chunkIndex = 0;
  let sectionTitle = "Introduction";

  for (const para of paragraphs) {
    // Detect section headings (ALL CAPS lines, numbered sections, etc.)
    const isHeading =
      /^[A-Z][A-Z\s\d.,:-]{5,}$/.test(para) ||
      /^\d+[\.\d]*\s+[A-Z]/.test(para) ||
      /^(SECTION|POLICY|PURPOSE|SCOPE|PROCEDURE|DEFINITIONS?|REFERENCES?)\b/i.test(
        para,
      );

    if (isHeading) {
      sectionTitle = para.slice(0, 80);
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

      // Keep overlap: last N tokens worth of text
      const overlapChars = OVERLAP * 4;
      currentChunk = currentChunk.slice(-overlapChars) + "\n\n" + para;
      currentTokens = estimateTokens(currentChunk);
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
