// Use the sub-path import to avoid pdf-parse's test file side effect in Next.js
/* eslint-disable */
const pdfParse = require("pdf-parse/lib/pdf-parse");
/* eslint-enable */

export async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text as string;
  } catch (err) {
    console.error("PDF parse error:", err);
    throw new Error("Failed to parse PDF. Ensure the file is a valid PDF.");
  }
}
