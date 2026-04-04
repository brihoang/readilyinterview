import type { PolicyChunk } from "@/lib/store/types";

// Simple TF-IDF-inspired keyword scoring for chunk retrieval
// No external services needed — sufficient for demo scale (50-500 chunks)

const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "shall",
  "can",
  "that",
  "this",
  "these",
  "those",
  "it",
  "its",
  "as",
  "if",
  "not",
  "no",
  "so",
  "than",
  "then",
  "when",
  "where",
  "which",
  "who",
  "what",
  "how",
  "all",
  "any",
  "each",
  "must",
  "also",
  "such",
  "other",
  "their",
  "they",
  "them",
  "we",
  "our",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function termFrequency(tokens: string[], term: string): number {
  const count = tokens.filter((t) => t === term).length;
  return count / (tokens.length || 1);
}

export function retrieveTopChunks(
  question: string,
  chunks: PolicyChunk[],
  topN = 5,
): PolicyChunk[] {
  if (chunks.length === 0) return [];

  const queryTokens = tokenize(question);
  if (queryTokens.length === 0) return chunks.slice(0, topN);

  // Score each chunk
  const scored = chunks.map((chunk) => {
    const chunkTokens = tokenize(chunk.text);
    let score = 0;
    for (const qt of queryTokens) {
      const tf = termFrequency(chunkTokens, qt);
      // Exact match bonus
      if (chunkTokens.includes(qt)) score += tf + 0.5;
      // Partial match (substring)
      else if (chunkTokens.some((ct) => ct.includes(qt) || qt.includes(ct))) {
        score += tf + 0.1;
      }
    }
    // Boost if query terms appear in the section title
    const titleTokens = tokenize(chunk.sectionTitle);
    for (const qt of queryTokens) {
      if (titleTokens.includes(qt)) score += 1.0;
    }
    return { chunk, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.chunk);
}
