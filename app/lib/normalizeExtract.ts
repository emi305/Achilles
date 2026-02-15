import { getWeightForCategory } from "./comlexWeights";
import { canonicalizeCategoryName } from "./nameMatching";
import type { ExtractedRow, NormalizedExtractResult, ParsedRow } from "./types";

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function normalizePercentCorrect(row: ExtractedRow): number | null {
  const total = toNumberOrUndefined(row.total);
  const correct = toNumberOrUndefined(row.correct);

  if (typeof correct === "number" && typeof total === "number" && total > 0) {
    return clamp01(correct / total);
  }

  const rawPercent = (row as unknown as { percentCorrect?: unknown }).percentCorrect;
  if (rawPercent === undefined || rawPercent === null) {
    return null;
  }

  let parsedPercent: number | undefined;

  if (typeof rawPercent === "string") {
    const trimmed = rawPercent.trim();
    if (!trimmed) {
      return null;
    }

    if (trimmed.includes("%")) {
      const parsed = Number.parseFloat(trimmed.replace("%", ""));
      if (!Number.isFinite(parsed)) {
        return null;
      }
      parsedPercent = parsed / 100;
    } else {
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) {
        return null;
      }
      parsedPercent = parsed;
    }
  } else {
    parsedPercent = toNumberOrUndefined(rawPercent);
  }

  if (typeof parsedPercent !== "number") {
    return null;
  }

  if (parsedPercent > 1) {
    parsedPercent /= 100;
  }

  return clamp01(parsedPercent);
}

export function normalizeExtractedRow(row: ExtractedRow): ExtractedRow {
  const total = toNumberOrUndefined(row.total);
  let correct = toNumberOrUndefined(row.correct);
  const normalizedPercent = normalizePercentCorrect(row);

  if (typeof correct !== "number" && typeof total === "number" && total > 0 && typeof normalizedPercent === "number") {
    correct = Math.round(normalizedPercent * total);
  }

  return {
    ...row,
    total,
    correct,
    percentCorrect: normalizedPercent ?? undefined,
  };
}

function buildParsedRow(row: ExtractedRow): { parsedRow?: ParsedRow; warning?: string; missingRequired: boolean } {
  const normalizedRow = normalizeExtractedRow(row);
  const matched = canonicalizeCategoryName(normalizedRow.categoryType, normalizedRow.name);
  const name = matched.canonicalName;
  const total = toNumberOrUndefined(normalizedRow.total);
  let correct = toNumberOrUndefined(normalizedRow.correct);
  const percentCorrect = toNumberOrUndefined(normalizedRow.percentCorrect);

  if (typeof total === "number" && total <= 0) {
    return {
      warning: `${name}: total must be greater than 0.`,
      missingRequired: true,
    };
  }

  if (typeof correct !== "number" && typeof total === "number" && typeof percentCorrect === "number") {
    correct = Math.round(percentCorrect * total);
  }

  if (typeof total !== "number" || typeof correct !== "number") {
    return {
      warning: `${name}: missing correct/total values.`,
      missingRequired: true,
    };
  }

  if (correct < 0 || correct > total) {
    return {
      warning: `${name}: correct must be between 0 and total.`,
      missingRequired: true,
    };
  }

  const accuracy = correct / total;
  const weight = getWeightForCategory(row.categoryType, name);
  const roi = (1 - accuracy) * weight;

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[normalizeExtract] ${normalizedRow.categoryType}: "${normalizedRow.name}" -> "${name}" (score=${matched.score.toFixed(3)}, unmapped=${matched.unmapped})`,
    );
  }

  return {
    parsedRow: {
      categoryType: normalizedRow.categoryType,
      name,
      correct,
      total,
      accuracy,
      weight,
      roi,
      originalName: normalizedRow.name,
      matchScore: matched.score,
      unmapped: matched.unmapped,
    },
    warning:
      matched.unmapped || weight === 0 ? `${normalizedRow.name}: not confidently mapped; weight may be 0.` : undefined,
    missingRequired: false,
  };
}

export function normalizeExtractRows(rows: ExtractedRow[]): NormalizedExtractResult {
  const warnings: string[] = [];
  const parsedRows: ParsedRow[] = [];
  let hasMissingRequired = false;

  for (const row of rows) {
    const result = buildParsedRow(row);
    if (result.warning) {
      warnings.push(result.warning);
    }

    if (result.missingRequired) {
      hasMissingRequired = true;
      continue;
    }

    if (result.parsedRow) {
      parsedRows.push(result.parsedRow);
    }
  }

  return {
    parsedRows,
    warnings,
    hasMissingRequired,
  };
}
