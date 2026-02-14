import { NextResponse } from "next/server";
import { extractPdfText } from "../../lib/extractPdfText";
import { ocrImageText } from "../../lib/ocrImageText";

export const runtime = "nodejs";

function safeErrorResponse(status: number, message: string, error?: string) {
  return NextResponse.json({ error, message }, { status });
}

function isSupportedImageType(mimeType: string) {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg";
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileCandidate = formData.get("file");

    if (!(fileCandidate instanceof File)) {
      return safeErrorResponse(400, "No file uploaded.");
    }

    const file = fileCandidate;
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    if (process.env.NODE_ENV === "development") {
      console.log("[import-file] type=", mimeType || "unknown", "name=", fileName);
    }

    let text = "";
    if (mimeType === "application/pdf" || fileName.endsWith(".pdf")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = await extractPdfText(buffer);

      if (text.length < 20) {
        return safeErrorResponse(
          400,
          "Couldn’t read this file. Try a clearer image or paste text.",
          "PDF_TEXT_TOO_SHORT",
        );
      }
    } else if (isSupportedImageType(mimeType) || /\.(png|jpg|jpeg)$/.test(fileName)) {
      text = await ocrImageText(file);
      if (!text) {
        return safeErrorResponse(400, "Couldn’t read this file. Try a clearer image or paste text.", "OCR_EMPTY");
      }
    } else {
      return safeErrorResponse(400, "Unsupported file type. Upload PDF, PNG, JPG, or JPEG.", "UNSUPPORTED_FILE_TYPE");
    }

    return NextResponse.json({ text }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[import-file] failed:", error);
    }

    if (error instanceof Error && error.name === "EXTRACTION_NOT_CONFIGURED") {
      return safeErrorResponse(
        500,
        "AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.",
        "EXTRACTION_NOT_CONFIGURED",
      );
    }

    return safeErrorResponse(500, "Couldn’t read this file. Try a clearer image or paste text.", "IMPORT_FAILED");
  }
}
