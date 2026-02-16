import { NextResponse } from "next/server";
import { parseScoreReport, type ScoreReportProxyRow } from "../../lib/scoreReportParse";
import { isTestType } from "../../lib/testSelection";
import type { TestType } from "../../lib/types";

export const runtime = "nodejs";

type ScoreReportFileResult = {
  filename: string;
  ok: boolean;
  rows?: ScoreReportProxyRow[];
  message?: string;
  error?: string;
};

function safeErrorResponse(status: number, message: string, error?: string) {
  return NextResponse.json({ error, message }, { status });
}

function isSupportedImageFile(file: File) {
  const type = file.type.toLowerCase();
  const lower = file.name.toLowerCase();
  return (
    type === "image/png" ||
    type === "image/jpeg" ||
    type === "image/jpg" ||
    lower.endsWith(".png") ||
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  );
}

function isPdfFile(file: File) {
  const type = file.type.toLowerCase();
  const lower = file.name.toLowerCase();
  return type === "application/pdf" || lower.endsWith(".pdf");
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const filesRaw = formData.getAll("scoreReports");
    const fallback = formData.get("scoreReport");
    const examValue = formData.get("exam");
    const exam: TestType = isTestType(examValue) ? examValue : "comlex2";
    const files = filesRaw.filter((value): value is File => value instanceof File);

    if (files.length === 0 && fallback instanceof File) {
      files.push(fallback);
    }

    if (files.length === 0) {
      return safeErrorResponse(400, "No score report uploaded.");
    }

    const results: ScoreReportFileResult[] = [];
    const mergedRows: ScoreReportProxyRow[] = [];
    const warnings: string[] = [];

    for (const file of files) {
      if (isPdfFile(file)) {
        const message = "PDF parsing not supported in v1 - upload a screenshot instead.";
        results.push({ filename: file.name, ok: false, error: "PDF_NOT_SUPPORTED_V1", message });
        warnings.push(`${file.name}: ${message}`);
        continue;
      }

      if (!isSupportedImageFile(file)) {
        const message = "Unsupported score report file type. Upload PNG, JPG, or JPEG.";
        results.push({ filename: file.name, ok: false, error: "UNSUPPORTED_FILE_TYPE", message });
        warnings.push(`${file.name}: ${message}`);
        continue;
      }

      try {
        const rows = await parseScoreReport(file, exam);
        results.push({ filename: file.name, ok: true, rows });
        mergedRows.push(...rows);
      } catch (error) {
        if (error instanceof Error && error.name === "EXTRACTION_NOT_CONFIGURED") {
          return safeErrorResponse(
            500,
            "AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.",
            "EXTRACTION_NOT_CONFIGURED",
          );
        }

        const message = "Could not parse this score report screenshot.";
        results.push({ filename: file.name, ok: false, error: "SCORE_REPORT_PARSE_FAILED", message });
        warnings.push(`${file.name}: ${message}`);
      }
    }

    return NextResponse.json(
      {
        results,
        proxyRows: mergedRows,
        warnings,
      },
      { status: 200 },
    );
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[score-report] parse failed:", error);
    }
    return safeErrorResponse(500, "Could not parse score report.", "SCORE_REPORT_PARSE_FAILED");
  }
}
