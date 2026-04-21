import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";
import { analyzeRegulation } from "@/lib/ai/analyzeRegulation";

export const maxDuration = 300;

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  await store.ensureAnticipatorLoaded();
  await ensureSeeded();

  const doc = store.getFederalDocument(params.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const allChunks = store.getAllChunks();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        await store.updateFederalDocument(params.id, { analysisStatus: "analyzing" });
        controller.enqueue(
          encoder.encode(JSON.stringify({ status: "analyzing" }) + "\n"),
        );

        const recommendation = await analyzeRegulation(doc, allChunks);
        await store.setRecommendation(recommendation);
        await store.updateFederalDocument(params.id, { analysisStatus: "done" });

        controller.enqueue(
          encoder.encode(JSON.stringify({ done: true, recommendation }) + "\n"),
        );
        controller.close();
      } catch (err) {
        await store.updateFederalDocument(params.id, { analysisStatus: "error" });
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: String(err) }) + "\n"),
        );
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Transfer-Encoding": "chunked",
    },
  });
}
