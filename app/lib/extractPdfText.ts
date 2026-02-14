export async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import("pdf-parse");
  const pdfParse = pdfParseModule.default;
  const result = await pdfParse(buffer);
  return (result.text ?? "").trim();
}
