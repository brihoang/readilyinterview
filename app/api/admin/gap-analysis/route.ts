import { NextRequest } from "next/server";
import { store } from "@/lib/store";
import { ensureSeeded } from "@/lib/seed";
import { analyzePolicy } from "@/lib/ai/analyzePolicy";

export async function POST(req: NextRequest) {
  await ensureSeeded();

  const body = await req.json().catch(() => ({}));
  const folder: string | undefined = body.folder;

  const docs = store.getPolicyDocuments().filter((d) =>
    folder && folder !== "all" ? d.folder === folder : true,
  );

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let analyzed = 0;
      for (const doc of docs) {
        try {
          const result = await analyzePolicy(doc);
          const line = JSON.stringify({
            docId: doc.id,
            title: doc.title,
            folder: doc.folder,
            category: doc.category,
            isPatched: doc.isPatched ?? false,
            ...result,
          });
          controller.enqueue(encoder.encode(line + "\n"));
          analyzed++;
        } catch (err) {
          console.error(`[gap-analysis] Failed for ${doc.id}:`, err);
        }
      }
      controller.enqueue(
        encoder.encode(JSON.stringify({ done: true, total: analyzed }) + "\n"),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson", "X-Content-Type-Options": "nosniff" },
  });
}
