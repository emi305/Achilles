import { NextResponse } from "next/server";
import pLimit from "p-limit";
import { extractPdfText } from "../../lib/extractPdfText";
import { ocrImageText } from "../../lib/ocrImageText";

export const runtime = "nodejs";

function safeErrorResponse(status: number, message: string, error?: string) {
  return NextResponse.json({ error, message }, { status });
}

function isSupportedImageType(mimeType: string) {
  return mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg";
}

type ImportFileResult = {
  filename: string;
  ok: boolean;
  text?: string;
  error?: string;
  message?: string;
};

async function extractTextFromFile(file: File): Promise<ImportFileResult> {
  const mimeType = file.type.toLowerCase();
  const filename = file.name;
  const fileNameLowered = file.name.toLowerCase();

  if (process.env.NODE_ENV === "development") {
    console.log("[import-file] file:", filename, "type:", mimeType || "unknown");
  }

  try {
    if (mimeType === "application/pdf" || fileNameLowered.endsWith(".pdf")) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const text = await extractPdfText(buffer);

      if (text.length < 20) {
        return {
          filename,
          ok: false,
          error: "PDF_TEXT_TOO_SHORT",
          message: "Couldn’t read this file. Try a clearer image or paste text.",
        };
      }

      return { filename, ok: true, text };
    }

    if (isSupportedImageType(mimeType) || /\.(png|jpg|jpeg)$/.test(fileNameLowered)) {
      const text = await ocrImageText(file);
      if (!text) {
        return {
          filename,
          ok: false,
          error: "OCR_EMPTY",
          message: "Couldn’t read this file. Try a clearer image or paste text.",
        };
      }

      return { filename, ok: true, text };
    }

    return {
      filename,
      ok: false,
      error: "UNSUPPORTED_FILE_TYPE",
      message: "Unsupported file type. Upload PDF, PNG, JPG, or JPEG.",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "EXTRACTION_NOT_CONFIGURED") {
      return {
        filename,
        ok: false,
        error: "EXTRACTION_NOT_CONFIGURED",
        message: "AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.",
      };
    }

    if (process.env.NODE_ENV === "development") {
      console.error("[import-file] per-file extraction failed:", filename, error);
    }

    return {
      filename,
      ok: false,
      error: "IMPORT_FAILED",
      message: "Couldn’t read this file. Try a clearer image or paste text.",
    };
  }
}

export async function POST(request: Request) {
  try {
    const startedAt = Date.now();
    const formData = await request.formData();
    const filesRaw = formData.getAll("files");
    const fallbackFile = formData.get("file");
    const files = filesRaw.filter((value): value is File => value instanceof File);

    if (files.length === 0 && fallbackFile instanceof File) {
      files.push(fallbackFile);
    }

    if (files.length === 0) {
      return safeErrorResponse(400, "No file uploaded.");
    }

    const concurrency = Math.max(1, Math.min(5, Number(process.env.IMPORT_FILE_CONCURRENCY ?? 4)));
    const limit = pLimit(concurrency);
    const results = await Promise.all(files.map((file) => limit(async () => extractTextFromFile(file))));

    if (process.env.NODE_ENV === "development") {
      const durationMs = Date.now() - startedAt;
      const successCount = results.filter((item) => item.ok).length;
      console.log(
        `[import-file] completed ${files.length} files in ${durationMs}ms (ok=${successCount}, failed=${files.length - successCount}, concurrency=${concurrency})`,
      );
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[import-file] failed:", error);
    }

    return safeErrorResponse(500, "Couldn’t read this file. Try a clearer image or paste text.", "IMPORT_FAILED");
  }
}
