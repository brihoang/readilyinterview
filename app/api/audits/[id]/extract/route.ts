import { NextRequest, NextResponse } from "next/server";
import { store } from "@/lib/store";
import { parsePdf } from "@/lib/pdf/parser";
import { extractQuestionsFromText } from "@/lib/ai/extractQuestions";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const audit = store.getAudit(params.id);
  if (!audit)
    return NextResponse.json({ error: "Audit not found" }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file)
    return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const pdfText = await parsePdf(buffer);

  store.updateAudit(params.id, {
    status: "extracting",
    questionnaireFileName: file.name,
  });

  try {
    const questions = await extractQuestionsFromText(pdfText, params.id);
    store.updateAudit(params.id, {
      status: "review",
      questions,
    });
    return NextResponse.json({ questions });
  } catch (err) {
    store.updateAudit(params.id, { status: "idle" });
    console.error("Extraction error:", err);
    return NextResponse.json(
      { error: "Failed to extract questions from PDF" },
      { status: 500 },
    );
  }
}
