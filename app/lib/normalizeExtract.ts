import { getWeightForCategory } from "./comlexWeights";
import type { CategoryType, ExtractedRow, NormalizedExtractResult, ParsedRow } from "./types";

const DISCIPLINE_ALIASES: Record<string, string> = {
  im: "Internal Medicine",
  "internal med": "Internal Medicine",
  "internal medicine": "Internal Medicine",
  fm: "Family Medicine",
  "family med": "Family Medicine",
  "family medicine": "Family Medicine",
  obgyn: "Obstetrics/Gynecology",
  "ob gyn": "Obstetrics/Gynecology",
  "ob/gyn": "Obstetrics/Gynecology",
  obg: "Obstetrics/Gynecology",
  psych: "Psychiatry",
  peds: "Pediatrics",
  ed: "Emergency Medicine",
  em: "Emergency Medicine",
  "emergency med": "Emergency Medicine",
  "osteopathic principles": "Osteopathic Principles and Practice",
  opp: "Osteopathic Principles and Practice",
  omm: "Osteopathic Principles and Practice",
};

const CLINICAL_ALIASES: Record<string, string> = {
  msk: "Patient Presentations Related to the Musculoskeletal System",
  musculoskeletal: "Patient Presentations Related to the Musculoskeletal System",
  neuro: "Patient Presentations Related to the Nervous System and Mental Health",
  gi: "Patient Presentations Related to the Gastrointestinal System and Nutritional Health",
  resp: "Patient Presentations Related to the Respiratory System",
  cards: "Patient Presentations Related to the Circulatory and Hematologic Systems",
  cardio: "Patient Presentations Related to the Circulatory and Hematologic Systems",
};

function normalizeName(categoryType: CategoryType, rawName: string): string {
  const trimmed = rawName.trim();
  const lowered = trimmed.toLowerCase();

  if (categoryType === "discipline") {
    return DISCIPLINE_ALIASES[lowered] ?? trimmed;
  }

  if (categoryType === "clinical_presentation") {
    return CLINICAL_ALIASES[lowered] ?? trimmed;
  }

  return trimmed;
}

function toNumberOrUndefined(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
}

function buildParsedRow(row: ExtractedRow): { parsedRow?: ParsedRow; warning?: string; missingRequired: boolean } {
  const name = normalizeName(row.categoryType, row.name);
  const total = toNumberOrUndefined(row.total);
  let correct = toNumberOrUndefined(row.correct);
  const percentCorrect = toNumberOrUndefined(row.percentCorrect);

  if (typeof percentCorrect === "number" && (percentCorrect < 0 || percentCorrect > 1)) {
    return {
      warning: `${name}: percentCorrect must be between 0 and 1.`,
      missingRequired: true,
    };
  }

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

  return {
    parsedRow: {
      categoryType: row.categoryType,
      name,
      correct,
      total,
      accuracy,
      weight,
      roi,
    },
    warning: weight === 0 ? `${name}: no known COMLEX weight match; weight set to 0.` : undefined,
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
