// Use the sub-path import to avoid pdf-parse's test file side effect in Next.js
/* eslint-disable */
const pdfParse = require("pdf-parse/lib/pdf-parse");
/* eslint-enable */

export function cleanPdfText(raw: string): string {
  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Rejoin words broken by hyphen + newline
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n");

  const lines = text.split("\n");

  // Count repeated mid-length lines — these are running headers/footers
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const key = line.trim().replace(/\s+/g, " ").toLowerCase();
    if (key.length >= 10 && key.length <= 100) {
      lineCounts.set(key, (lineCounts.get(key) ?? 0) + 1);
    }
  }
  const docPageEstimate = Math.max(1, text.length / 3000);
  const repeatThreshold = Math.max(3, Math.floor(docPageEstimate * 0.4));
  const boilerplate = new Set(
    [...lineCounts.entries()]
      .filter(([, n]) => n >= repeatThreshold)
      .map(([k]) => k),
  );

  const cleaned = lines.filter((line) => {
    const t = line.trim().replace(/\s+/g, " ");
    if (/^\d+$/.test(t)) return false;
    if (/^-\s*\d+\s*-$/.test(t)) return false;
    // "Page N of N ..." — match any line starting with spaced-out page pattern
    if (/^p\s*a\s*g\s*e\s+\d+/i.test(t)) return false;
    if (/^\d+\s+of\s+\d+\b/.test(t)) return false;
    const key = t.toLowerCase();
    return !boilerplate.has(key);
  });

  // Protect heading lines so they aren't soft-joined onto the next line.
  // Insert a blank line after any line that looks like a section heading.
  const protectedLines = cleaned.map((line) => {
    const t = line.trim();
    const looksLikeHeading =
      /^[A-Z][A-Z\s\d.,:-]{5,}$/.test(t) ||
      /^[IVX]+\.\s+[A-Z]/.test(t) ||
      /^(PURPOSE|SCOPE|PROCEDURE|DEFINITIONS?|REFERENCES?|OVERVIEW|BACKGROUND|RESPONSIBILITIES|REQUIREMENTS?|INTRODUCTION|APPENDIX|POLICY)\b.{0,35}$/i.test(t);
    return looksLikeHeading ? "\n" + line + "\n" : line;
  });

  // Join soft-wrapped prose lines: single \n between non-empty lines → space
  // Preserves paragraph breaks (\n\n) but collapses visual line wraps
  text = protectedLines
    .join("\n")
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

  // Deduplicate consecutive near-duplicate paragraphs (multi-column artifact)
  const paras = text.split(/\n\n+/);
  const result: string[] = [];
  for (const para of paras) {
    const trimmed = para.trim();
    if (!trimmed || trimmed.length < 20) continue;

    const norm = trimmed.replace(/\s+/g, " ").toLowerCase();
    const isDup = result.slice(-4).some((prev) => {
      const prevNorm = prev.replace(/\s+/g, " ").toLowerCase();
      const shorter = norm.length < prevNorm.length ? norm : prevNorm;
      const longer = norm.length >= prevNorm.length ? norm : prevNorm;
      if (shorter.length > 80 && longer.includes(shorter)) return true;
      const wordsA = new Set(norm.split(/\s+/));
      const wordsB = new Set(prevNorm.split(/\s+/));
      const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
      const union = new Set([...wordsA, ...wordsB]).size;
      return intersection / union > 0.75;
    });

    if (!isDup) result.push(trimmed);
  }

  return result.join("\n\n");
}

export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return cleanPdfText(data.text as string);
  } catch (err) {
    console.error("PDF parse error:", err);
    throw new Error("Failed to parse PDF. Ensure the file is a valid PDF.");
  }
}
