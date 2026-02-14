import { NextResponse } from "next/server";
import { computeOverallConfidence } from "../../lib/confidence";
import type { CategoryType, ExtractedRow, ExtractResponse } from "../../lib/types";

export const runtime = "nodejs";

type ExtractRequest = {
  exam: "comlex2";
  rawText: string;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

const SYSTEM_PROMPT = `You extract COMLEX Level 2-style performance rows from messy text and pasted tables.

Return JSON only with this exact shape:
{
  "rows": [
    {
      "categoryType": "discipline" | "competency_domain" | "clinical_presentation",
      "name": string,
      "correct": number | null,
      "total": number | null,
      "percentCorrect": number | null,
      "confidence": number
    }
  ],
  "warnings": string[]
}

Rules:
- Extract only rows that reflect performance and include at least total questions or percent correct.
- Map synonyms when possible:
  - IM/internal med/internal medicine -> Internal Medicine
  - OBGYN/Ob-Gyn -> Obstetrics/Gynecology
  - MSK -> Patient Presentations Related to the Musculoskeletal System
- Use categoryType values exactly: discipline, competency_domain, clinical_presentation.
- confidence must be 0..1.
- If uncertain, include row with lower confidence.
- If input is insufficient, return rows: [] and warnings explaining what is missing.
- Never include markdown or commentary, only valid JSON.`;

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function isCategoryType(value: unknown): value is CategoryType {
  return value === "discipline" || value === "competency_domain" || value === "clinical_presentation";
}

function sanitizeRows(input: unknown): ExtractedRow[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const rows: ExtractedRow[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const candidate = row as Record<string, unknown>;
    const categoryType = candidate.categoryType;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const confidence = toSafeNumber(candidate.confidence);
    if (!isCategoryType(categoryType) || !name || typeof confidence !== "number") {
      continue;
    }

    const correct = toSafeNumber(candidate.correct);
    const total = toSafeNumber(candidate.total);
    const percentCorrect = toSafeNumber(candidate.percentCorrect);

    rows.push({
      categoryType,
      name,
      correct,
      total,
      percentCorrect,
      confidence: Math.max(0, Math.min(1, confidence)),
    });
  }

  return rows;
}

function safeErrorResponse(status: number, message: string, error?: string) {
  return NextResponse.json({ error, message }, { status });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<ExtractRequest>;
    const exam = body.exam;
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";

    if (exam !== "comlex2") {
      return safeErrorResponse(400, "Unsupported exam. Use exam=comlex2.");
    }

    if (!rawText) {
      return safeErrorResponse(400, "Input text is empty.");
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[extract] OPENAI_API_KEY missing");
      }
      return safeErrorResponse(
        500,
        "OPENAI_API_KEY missing. Set it in .env.local and restart dev server.",
        "EXTRACTION_NOT_CONFIGURED",
      );
    }

    const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;
    const completionResponse = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Exam: ${exam}\n\nRaw input:\n${rawText}`,
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "extract_response",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                rows: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      categoryType: {
                        type: "string",
                        enum: ["discipline", "competency_domain", "clinical_presentation"],
                      },
                      name: { type: "string" },
                      correct: { type: ["number", "null"] },
                      total: { type: ["number", "null"] },
                      percentCorrect: { type: ["number", "null"] },
                      confidence: { type: "number" },
                    },
                    required: ["categoryType", "name", "correct", "total", "percentCorrect", "confidence"],
                  },
                },
                warnings: {
                  type: "array",
                  items: { type: "string" },
                },
              },
              required: ["rows", "warnings"],
            },
          },
        },
      }),
    });

    if (!completionResponse.ok) {
      return safeErrorResponse(500, "Extraction service request failed. Please try again.");
    }

    const completionJson = (await completionResponse.json()) as OpenAIChatResponse;
    const content = completionJson.choices?.[0]?.message?.content;
    if (!content) {
      return safeErrorResponse(500, "No extraction output returned.");
    }

    let parsedContent: { rows?: unknown; warnings?: unknown };
    try {
      parsedContent = JSON.parse(content) as { rows?: unknown; warnings?: unknown };
    } catch {
      return safeErrorResponse(500, "Extraction response was not valid JSON.");
    }

    const rows = sanitizeRows(parsedContent.rows);
    const warnings = Array.isArray(parsedContent.warnings)
      ? parsedContent.warnings.filter((warning): warning is string => typeof warning === "string")
      : [];

    const response: ExtractResponse = {
      rows,
      overallConfidence: computeOverallConfidence(rows),
      warnings,
    };

    return NextResponse.json(response, { status: 200 });
  } catch {
    return safeErrorResponse(500, "Unable to process extraction request.");
  }
}
