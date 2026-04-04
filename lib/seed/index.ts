import path from "path";
import fs from "fs";
import { nanoid } from "nanoid";
import { store } from "@/lib/store";
import { parsePdf } from "@/lib/pdf/parser";
import { chunkText } from "@/lib/pdf/chunker";

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
  // Strip extension
  const base = filename.replace(/\.pdf$/i, "");
  // Replace underscores/dashes with spaces, trim CEO/date suffixes
  return base
    .replace(/[_-]/g, " ")
    .replace(/\s+(CEO|v\d{8}|v\d{4}\d{2}\d{2}|\d{8})\S*/gi, "")
    .trim();
}

let seeded = false;
let seeding = false;

export async function ensureSeeded(): Promise<void> {
  if (seeded || seeding) return;
  seeding = true;

  try {
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
    seeded = true;
  } finally {
    seeding = false;
  }
}
