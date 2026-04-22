import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { parsePdf } from "@/lib/pdf/parser";
import { chunkText } from "@/lib/pdf/chunker";

const PRECOMPUTED_PATH = path.join(
  process.cwd(),
  "lib",
  "seed",
  "precomputed-chunks.json",
);
const POLICIES_DIR = path.join(process.cwd(), "policies");

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

let seeded = false;
let seeding = false;

export async function ensureSeeded(): Promise<void> {
  if (seeding) return;
  seeding = true;

  try {
    // Fast path: load precomputed chunks JSON (no PDF parsing needed)
    // Always reload to pick up patches from other Vercel instances via Redis
    if (fs.existsSync(PRECOMPUTED_PATH)) {
      if (!seeded) {
        // Only parse and load docs once per container — addPolicyDocument is idempotent
        // but parsing 11MB JSON on every request would be too slow
        const raw = fs.readFileSync(PRECOMPUTED_PATH, "utf-8");
        const docs = JSON.parse(raw) as {
          title: string;
          filename: string;
          folder: string;
          category: string;
          dateAdded: string;
          chunks: {
            id: string;
            sectionTitle: string;
            text: string;
            chunkIndex: number;
          }[];
        }[];

        for (const doc of docs) {
          store.addPolicyDocument({
            title: doc.title,
            filename: doc.filename,
            folder: doc.folder,
            category: doc.category,
            dateAdded: doc.dateAdded,
            rawText: "",
            chunks: doc.chunks.map((c) => ({
              ...c,
              id: c.id ?? nanoid(),
              documentId: "",
            })),
          });
        }

        console.log(`[seed] Loaded ${docs.length} policy documents from precomputed cache`);
        seeded = true;
      }

      // Always replay patches so accepted patches from other instances are applied
      await store.replayPersistedPatches();
      return;
    }

    // Fallback: parse PDFs from disk (slow — run npm run precompute to avoid this)
    console.warn(
      "[seed] No precomputed-chunks.json found, falling back to PDF parsing (slow)",
    );

    if (!fs.existsSync(POLICIES_DIR)) {
      console.warn("[seed] policies/ directory not found, skipping");
      seeded = true;
      return;
    }

    const folders = fs
      .readdirSync(POLICIES_DIR)
      .filter((f) => fs.statSync(path.join(POLICIES_DIR, f)).isDirectory());

    let loaded = 0;
    for (const folder of folders) {
      const folderPath = path.join(POLICIES_DIR, folder);
      const files = fs
        .readdirSync(folderPath)
        .filter((f) => f.toLowerCase().endsWith(".pdf"));

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        try {
          const buffer = fs.readFileSync(filePath);
          const rawText = await parsePdf(buffer);
          if (!rawText.trim()) continue;

          const docId = nanoid();
          const chunks = chunkText(rawText, docId);

          store.addPolicyDocument({
            title: filenameToTitle(file),
            filename: file,
            folder,
            category: inferCategory(folder),
            dateAdded: new Date().toISOString(),
            chunks,
            rawText,
          });
          loaded++;
        } catch (err) {
          console.warn(`[seed] Failed to parse ${file}:`, err);
        }
      }
    }

    console.log(`[seed] Loaded ${loaded} policy documents`);
    await store.replayPersistedPatches();
    seeded = true;
  } finally {
    seeding = false;
  }
}
