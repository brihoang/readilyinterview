import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await ensureSeeded();
  const docs = store.getPolicyDocuments().map((d) => ({
    id: d.id,
    title: d.title,
    filename: d.filename,
    folder: d.folder,
    category: d.category,
    dateAdded: d.dateAdded,
    chunkCount: d.chunks.length,
  }));
  return NextResponse.json({ documents: docs });
}
