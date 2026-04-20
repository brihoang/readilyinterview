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
const OVERLAP = 100;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
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
  let sectionTitle = "Introduction";

  for (const para of paragraphs) {
    const isHeading =
      /^[A-Z][A-Z\s\d.,:-]{5,}$/.test(para) ||
      /^\d+[\.\d]*\s+[A-Z]/.test(para) ||
      /^(SECTION|POLICY|PURPOSE|SCOPE|PROCEDURE|DEFINITIONS?|REFERENCES?)\b/i.test(
        para,
      );

    if (isHeading) sectionTitle = para.slice(0, 80);

    const paraTokens = estimateTokens(para);

    if (currentTokens + paraTokens > CHUNK_SIZE && currentChunk) {
      chunks.push({
        id: nanoid(),
        sectionTitle,
        text: currentChunk.trim(),
        chunkIndex: chunkIndex++,
      });
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
        const { text } = await pdfParse(buffer);
        if (!text?.trim()) continue;

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
