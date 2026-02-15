import { getWeightForCategory } from "./comlexWeights";
import { canonicalizeCategoryName } from "./nameMatching";
import type { CategoryType, ParsedRow } from "./types";

const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";

export type ScoreReportProxyRow = {
  categoryType: CategoryType;
  name: string;
  proxyWeakness: number;
};

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function stripJsonCodeFence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed.startsWith("```")) {
    return trimmed;
  }

  return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function parseScoreReportRows(content: string): ScoreReportProxyRow[] {
  const cleaned = stripJsonCodeFence(content);
  const parsed = JSON.parse(cleaned) as {
    rows?: Array<{ categoryType?: string; name?: string; proxyWeakness?: number }>;
  };

  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const normalized: ScoreReportProxyRow[] = [];

  for (const row of rows) {
    const categoryType = row.categoryType;
    const name = typeof row.name === "string" ? row.name.trim() : "";
    const proxyWeakness = typeof row.proxyWeakness === "number" ? clamp01(row.proxyWeakness) : undefined;

    if (
      (categoryType === "discipline" ||
        categoryType === "competency_domain" ||
        categoryType === "clinical_presentation") &&
      name &&
      typeof proxyWeakness === "number"
    ) {
      normalized.push({
        categoryType,
        name,
        proxyWeakness,
      });
    }
  }

  return normalized;
}

export async function parseScoreReport(file: File): Promise<ScoreReportProxyRow[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error("OPENAI_API_KEY missing.");
    error.name = "EXTRACTION_NOT_CONFIGURED";
    throw error;
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/png";
  const base64 = bytes.toString("base64");
  const imageUrl = `data:${mimeType};base64,${base64}`;
  const model = process.env.OPENAI_MODEL ?? DEFAULT_MODEL;

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You read COMLEX-style score report graphs. Return strict JSON only. Estimate proxyWeakness from graph-bar position: lower performance=high weakness, average=medium, higher=low. proxyWeakness must be in [0,1].",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Extract score report categories and weakness from graph bars.",
                "Output JSON: {\"rows\":[{\"categoryType\":\"discipline|competency_domain|clinical_presentation\",\"name\":\"...\",\"proxyWeakness\":0.0}]}",
                "Only include categories you can see.",
              ].join(" "),
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("Score report parsing request failed.");
  }

  const json = (await response.json()) as OpenAIChatResponse;
  const content = (json.choices?.[0]?.message?.content ?? "").trim();
  if (!content) {
    return [];
  }

  return parseScoreReportRows(content);
}

function proxyKey(categoryType: CategoryType, name: string) {
  return `${categoryType}::${name}`;
}

export function mergeScoreReportProxyRows(parsedRows: ParsedRow[], proxyRows: ScoreReportProxyRow[]): ParsedRow[] {
  if (proxyRows.length === 0) {
    return parsedRows;
  }

  const normalizedProxyMap = new Map<string, ScoreReportProxyRow>();
  for (const proxyRow of proxyRows) {
    const canonical = canonicalizeCategoryName(proxyRow.categoryType, proxyRow.name).canonicalName;
    normalizedProxyMap.set(proxyKey(proxyRow.categoryType, canonical), {
      ...proxyRow,
      name: canonical,
      proxyWeakness: clamp01(proxyRow.proxyWeakness),
    });
  }

  const usedKeys = new Set<string>();
  const mergedRows = parsedRows.map((row) => {
    const canonical = canonicalizeCategoryName(row.categoryType, row.name).canonicalName;
    const key = proxyKey(row.categoryType, canonical);
    const proxy = normalizedProxyMap.get(key);

    if (!proxy) {
      return row;
    }

    usedKeys.add(key);
    const proxyWeakness = clamp01(proxy.proxyWeakness);
    return {
      ...row,
      proxyWeakness,
      proi: proxyWeakness * row.weight,
    };
  });

  for (const [key, proxy] of normalizedProxyMap.entries()) {
    if (usedKeys.has(key)) {
      continue;
    }

    const weight = getWeightForCategory(proxy.categoryType, proxy.name);
    const proxyWeakness = clamp01(proxy.proxyWeakness);
    mergedRows.push({
      categoryType: proxy.categoryType,
      name: proxy.name,
      weight,
      roi: 0,
      proxyWeakness,
      proi: proxyWeakness * weight,
    });
  }

  return mergedRows;
}
