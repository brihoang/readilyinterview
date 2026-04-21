import { NextResponse } from "next/server";
import { store } from "@/lib/store";
import { fetchProposedRegulations } from "@/lib/federal-register/client";

export async function POST() {
  await store.ensureAnticipatorLoaded();

  let frDocs;
  try {
    frDocs = await fetchProposedRegulations({ perPage: 20 });
  } catch (e) {
    return NextResponse.json(
      { error: String(e) },
      { status: 502 },
    );
  }

  let added = 0;
  for (const fr of frDocs) {
    const doc = store.addFederalDocument({
      documentNumber: fr.document_number,
      title: fr.title,
      abstract: fr.abstract ?? "",
      agencies: fr.agencies.map((a) => a.name),
      publicationDate: fr.publication_date,
      htmlUrl: fr.html_url,
      type: fr.type,
      fetchedAt: new Date().toISOString(),
      analysisStatus: "pending",
    });
    if (doc !== null) added++;
  }

  return NextResponse.json({ added, total: store.getFederalDocuments().length });
}
