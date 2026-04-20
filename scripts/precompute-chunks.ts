/**
 * Parses all PDFs in /policies and writes the chunked output to
 * lib/seed/precomputed-chunks.json so Vercel cold starts don't need
 * to do it at runtime.
 *
 * Run with: npm run precompute
 */

import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse/lib/pdf-parse");

const POLICIES_DIR = path.join(process.cwd(), "policies");
const OUTPUT_FILE = path.join(
  process.cwd(),
  "lib",
  "seed",
  "precomputed-chunks.json",
);

const CHUNK_SIZE = 800;

function cleanPdfText(raw: string): string {
  let text = raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/(\w)-\n(\w)/g, "$1$2")
    .replace(/\n{3,}/g, "\n\n");

  const lines = text.split("\n");
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
    // Any line starting with page number pattern (with or without trailing title)
    if (/^p\s*a\s*g\s*e\s+\d+/i.test(t)) return false;
    if (/^\d+\s+of\s+\d+\b/.test(t)) return false;
    const key = t.toLowerCase();
    return !boilerplate.has(key);
  });

  const protectedLines = cleaned.map((line) => {
    const t = line.trim();
    const looksLikeHeading =
      /^[A-Z][A-Z\s\d.,:-]{5,}$/.test(t) ||
      /^[IVX]+\.\s+[A-Z]/.test(t) ||
      /^(PURPOSE|SCOPE|PROCEDURE|DEFINITIONS?|REFERENCES?|OVERVIEW|BACKGROUND|RESPONSIBILITIES|REQUIREMENTS?|INTRODUCTION|APPENDIX|POLICY)\b.{0,35}$/i.test(t);
    return looksLikeHeading ? "\n" + line + "\n" : line;
  });

  text = protectedLines
    .join("\n")
    .replace(/([^\n])\n([^\n])/g, "$1 $2")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");

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

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function extractSectionTitle(para: string): string {
  const flat = para.replace(/\s+/g, " ").trim();

  const titleField = flat.match(/\bTitle:\s*([^:]+?)(?:\s+(?:Department|Section|Division|Program):|$)/i);
  if (titleField) return titleField[1].trim().slice(0, 80);

  const romanLabel = flat.match(/^([IVX]+\.\s+[^:.]{2,40})(?:[:.]\s|$)/);
  if (romanLabel) return romanLabel[1].trim();

  if (/^[A-Z][A-Z\s\d.,:-]{5,}$/.test(flat)) return flat.slice(0, 60);

  const firstPhrase = flat.split(/[,;]/)[0];
  return firstPhrase.slice(0, 60).trim();
}

function chunkText(
  text: string,
): { id: string; sectionTitle: string; text: string; chunkIndex: number }[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: {
    id: string;
    sectionTitle: string;
    text: string;
    chunkIndex: number;
  }[] = [];
  let currentChunk = "";
  let currentTokens = 0;
  let chunkIndex = 0;
  let sectionTitle = "";

  for (const para of paragraphs) {
    const isHeading =
      /^[A-Z][A-Z\s\d.,:-]{5,}$/.test(para) ||
      /^[IVX]+\.\s+[A-Z]/.test(para) ||
      /^Title:\s+\S/.test(para) ||
      /^(SECTION|POLICY|PURPOSE|SCOPE|PROCEDURE|DEFINITIONS?|REFERENCES?|OVERVIEW|BACKGROUND|RESPONSIBILITIES|GUIDELINES?|STANDARDS?|REQUIREMENTS?|INTRODUCTION|APPENDIX)\b.{0,35}$/i.test(para) ||
      (para.length <= 60 &&
        !/[.?!;]$/.test(para) &&
        /^[A-Z]/.test(para) &&
        para.split(/\s+/).length <= 8 &&
        para.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).length >=
          Math.ceil(para.split(/\s+/).length * 0.6));

    if (isHeading) sectionTitle = extractSectionTitle(para);

    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > CHUNK_SIZE && currentChunk) {
      chunks.push({
        id: nanoid(),
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
      sectionTitle,
      text: currentChunk.trim(),
      chunkIndex: chunkIndex,
    });
  }

  return chunks;
}

function inferCategory(folder: string): string {
  const map: Record<string, string> = {
    AA: "Administrative",
    CMC: "Care Management & Compliance",
    DD: "Data & Documentation",
    EE: "Emergency & Environment",
    FF: "Finance & Facilities",
    GA: "General Administration",
    GG: "Governance & Guidelines",
    HH: "Human Resources & Health",
    MA: "Medical Affairs",
    PA: "Patient Access",
  };
  return map[folder.toUpperCase()] ?? folder;
}

function filenameToTitle(filename: string): string {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+(CEO|v\d{8}|v\d{4}\d{2}\d{2}|\d{8})\S*/gi, "")
    .trim();
}

async function main() {
  if (!fs.existsSync(POLICIES_DIR)) {
    console.error("policies/ directory not found");
    process.exit(1);
  }

  const folders = fs
    .readdirSync(POLICIES_DIR)
    .filter((f) => fs.statSync(path.join(POLICIES_DIR, f)).isDirectory());

  const docs: {
    title: string;
    filename: string;
    folder: string;
    category: string;
    dateAdded: string;
    chunks: { id: string; sectionTitle: string; text: string; chunkIndex: number }[];
  }[] = [];

  let loaded = 0;
  let failed = 0;

  for (const folder of folders) {
    const folderPath = path.join(POLICIES_DIR, folder);
    const files = fs
      .readdirSync(folderPath)
      .filter((f) => f.toLowerCase().endsWith(".pdf"));

    for (const file of files) {
      try {
        const buffer = fs.readFileSync(path.join(folderPath, file));
        const { text: rawText } = await pdfParse(buffer);
        if (!rawText?.trim()) continue;

        const text = cleanPdfText(rawText);
        const chunks = chunkText(text);
        if (chunks.length === 0) continue;

        docs.push({
          title: filenameToTitle(file),
          filename: file,
          folder,
          category: inferCategory(folder),
          dateAdded: new Date().toISOString(),
          chunks,
        });

        loaded++;
        if (loaded % 50 === 0) console.log(`  ${loaded} docs processed...`);
      } catch {
        failed++;
        console.warn(`  Failed: ${file}`);
      }
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(docs, null, 0));

  const sizeKB = Math.round(fs.statSync(OUTPUT_FILE).size / 1024);
  console.log(
    `\nDone: ${loaded} documents, ${docs.reduce((n, d) => n + d.chunks.length, 0)} chunks → ${sizeKB}KB`,
  );
  if (failed > 0) console.warn(`${failed} files failed to parse`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
