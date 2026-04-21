import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";

export async function GET() {
  await store.ensureAnticipatorLoaded();
  await ensureSeeded();

  const documents = store.getFederalDocuments();
  const allRecs = store.getAllRecommendations();
  const recommendations = Object.fromEntries(allRecs.map((r) => [r.documentId, r]));

  return NextResponse.json({ documents, recommendations });
}
