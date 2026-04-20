import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  await ensureSeeded();
  const doc = store.getPolicyDocument(params.id);
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: doc.id,
    title: doc.title,
    filename: doc.filename,
    folder: doc.folder,
    category: doc.category,
    dateAdded: doc.dateAdded,
    chunks: doc.chunks.map((c) => ({
      id: c.id,
      sectionTitle: c.sectionTitle,
      text: c.text,
      chunkIndex: c.chunkIndex,
    })),
  });
}
