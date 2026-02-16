import { NextResponse } from "next/server";
import { computeOverallConfidence } from "../../lib/confidence";
import { getAllowedCategoryTypes } from "../../lib/blueprint";
import { isTestType } from "../../lib/testSelection";
import type { CategoryType, ExtractedRow, ExtractResponse, TestType } from "../../lib/types";

export const runtime = "nodejs";

type ExtractRequest = {
  exam: TestType;
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

function getSystemPrompt(exam: TestType): string {
  const examInstructions =
    exam === "usmle_step2"
      ? [
          "Extract USMLE Step 2 CK rows across categories: discipline, system, physician_task.",
          "Step 2 discipline examples: Medicine, Surgery, Pediatrics, Obstetrics & Gynecology, Psychiatry.",
          "Step 2 system examples: Social Sciences (Ethics/Safety/Legal), Renal/Urinary & Reproductive, Cardiovascular System, Musculoskeletal System & Skin, Gastrointestinal System, Respiratory System.",
          "Step 2 physician_task examples: Patient Care: Management, Patient Care: Diagnosis, Health Maintenance & Disease Prevention.",
        ].join(" ")
      : [
          "Extract COMLEX Level 2 rows across categories: discipline, competency_domain, clinical_presentation.",
          "Map common variants like IM/internal med, OBGYN, MSK when possible.",
        ].join(" ");

  return `You extract standardized test performance rows from messy text and pasted tables.

${examInstructions}

Return JSON only with this exact shape:
{
  "rows": [
    {
      "categoryType": string,
      "name": string,
      "mappedCanonicalName": string | null,
      "correct": number | null,
      "total": number | null,
      "percentCorrect": number | null,
      "proxyWeakness": number | null,
      "confidence": number
    }
  ],
  "warnings": string[]
}

Rules:
- Extract only rows that reflect performance and include at least total questions or percent correct or score-report style bar weakness.
- For score-report style data without correct/total, estimate proxyWeakness in 0..1 from performance-bar position:
  - lower/below average -> high proxyWeakness (~0.75..1.0)
  - average/mid -> medium (~0.35..0.65)
  - higher/above average -> low (~0.0..0.25)
- confidence must be 0..1.
- If uncertain, include row with lower confidence.
- If input is insufficient, return rows: [] and warnings explaining what is missing.
- Never include markdown or commentary, only valid JSON.`;
}

function toSafeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function sanitizeRows(input: unknown, allowedCategoryTypes: CategoryType[]): ExtractedRow[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const allowed = new Set(allowedCategoryTypes);
  const rows: ExtractedRow[] = [];
  for (const row of input) {
    if (!row || typeof row !== "object") {
      continue;
    }

    const candidate = row as Record<string, unknown>;
    const categoryType = candidate.categoryType;
    const name = typeof candidate.name === "string" ? candidate.name.trim() : "";
    const confidence = toSafeNumber(candidate.confidence);

    if (typeof categoryType !== "string" || !allowed.has(categoryType as CategoryType) || !name || typeof confidence !== "number") {
      continue;
    }

    const correct = toSafeNumber(candidate.correct);
    const total = toSafeNumber(candidate.total);
    const percentCorrect = toSafeNumber(candidate.percentCorrect);
    const proxyWeakness = toSafeNumber(candidate.proxyWeakness);
    const mappedCanonicalName =
      typeof candidate.mappedCanonicalName === "string" ? candidate.mappedCanonicalName.trim() : undefined;

    rows.push({
      categoryType: categoryType as CategoryType,
      name,
      mappedCanonicalName,
      correct,
      total,
      percentCorrect,
      proxyWeakness,
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
    const exam: TestType = isTestType(body.exam) ? body.exam : "comlex2";
    const rawText = typeof body.rawText === "string" ? body.rawText.trim() : "";

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

    const allowedCategoryTypes = getAllowedCategoryTypes(exam);
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
          { role: "system", content: getSystemPrompt(exam) },
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
                        enum: allowedCategoryTypes,
                      },
                      name: { type: "string" },
                      mappedCanonicalName: { type: ["string", "null"] },
                      correct: { type: ["number", "null"] },
                      total: { type: ["number", "null"] },
                      percentCorrect: { type: ["number", "null"] },
                      proxyWeakness: { type: ["number", "null"] },
                      confidence: { type: "number" },
                    },
                    required: [
                      "categoryType",
                      "name",
                      "mappedCanonicalName",
                      "correct",
                      "total",
                      "percentCorrect",
                      "proxyWeakness",
                      "confidence",
                    ],
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

    const rows = sanitizeRows(parsedContent.rows, allowedCategoryTypes);
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
