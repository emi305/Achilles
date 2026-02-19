import { getWeightForCategory } from "./blueprint";
import { computeAccuracy, parseIntSafe } from "./avgCorrect";
import { canonicalizeCategoryName } from "./nameMatching";
import type { QbankSource } from "./mappingCatalog";
import type { ExtractedRow, InputSource, NormalizedExtractResult, ParsedRow, TestType } from "./types";

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

function toIntOrUndefined(value: unknown): number | undefined {
  const parsed = parseIntSafe(value);
  return parsed == null ? undefined : parsed;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalizeProxyWeakness(value: unknown): number | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (!lowered) {
      return undefined;
    }

    if (/(below|low|left|lower)/.test(lowered)) {
      return 0.85;
    }

    if (/(average|middle|mid|center)/.test(lowered)) {
      return 0.5;
    }

    if (/(above|high|right|higher)/.test(lowered)) {
      return 0.15;
    }

    const asNumber = Number(lowered.replace("%", ""));
    if (Number.isFinite(asNumber)) {
      const normalized = asNumber > 1 ? asNumber / 100 : asNumber;
      return clamp01(normalized);
    }

    return undefined;
  }

  const numeric = toNumberOrUndefined(value);
  if (typeof numeric !== "number") {
    return undefined;
  }

  return clamp01(numeric > 1 ? numeric / 100 : numeric);
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
  const incorrectCount = toIntOrUndefined(row.incorrectCount);
  const omittedCount = toIntOrUndefined(row.omittedCount);
  const usageUsed = toIntOrUndefined(row.usageUsed);
  const usageTotal = toIntOrUndefined(row.usageTotal);
  const normalizedPercent = normalizePercentCorrect(row);

  if (typeof correct !== "number" && typeof total === "number" && total > 0 && typeof normalizedPercent === "number") {
    correct = Math.round(normalizedPercent * total);
  }

  return {
    ...row,
    total,
    correct,
    incorrectCount,
    omittedCount,
    usageUsed,
    usageTotal,
    percentCorrect: normalizedPercent ?? undefined,
    proxyWeakness: normalizeProxyWeakness(row.proxyWeakness),
  };
}

function allocateIntegerShares(total: number, shares: number[]): number[] {
  if (total <= 0 || shares.length === 0) {
    return shares.map(() => 0);
  }

  const sumShares = shares.reduce((sum, value) => sum + value, 0);
  const normalizedShares = sumShares > 0 ? shares : shares.map(() => 1);
  const normalizedSum = normalizedShares.reduce((sum, value) => sum + value, 0);

  const exact = normalizedShares.map((share) => (share / normalizedSum) * total);
  const floored = exact.map((value) => Math.floor(value));
  let remainder = total - floored.reduce((sum, value) => sum + value, 0);

  const remainders = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder);

  let pointer = 0;
  while (remainder > 0 && remainders.length > 0) {
    const target = remainders[pointer % remainders.length];
    floored[target.index] += 1;
    remainder -= 1;
    pointer += 1;
  }

  return floored;
}

function rebalanceCorrectAgainstTotals(correctAllocations: number[], totalAllocations: number[]) {
  const corrected = [...correctAllocations];

  for (let index = 0; index < corrected.length; index += 1) {
    if (corrected[index] <= totalAllocations[index]) {
      continue;
    }

    let overflow = corrected[index] - totalAllocations[index];
    corrected[index] = totalAllocations[index];

    for (let target = 0; target < corrected.length && overflow > 0; target += 1) {
      if (target === index) {
        continue;
      }
      const capacity = totalAllocations[target] - corrected[target];
      if (capacity <= 0) {
        continue;
      }

      const transfer = Math.min(capacity, overflow);
      corrected[target] += transfer;
      overflow -= transfer;
    }
  }

  return corrected;
}

function getSplitParts(name: string): string[] {
  return name
    .split(/\s*(?:\/|&|\band\b)\s*/gi)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

const UWORLD_SYSTEM_CANONICAL_OVERRIDES: Record<string, string> = {
  "cardiovascular system": "Cardiovascular",
  "endocrine, diabetes & metabolism": "Endocrine",
  "gastrointestinal & nutrition": "Gastrointestinal",
  "nervous system": "Nervous System & Special Senses",
  "pulmonary & critical care": "Respiratory",
  "renal, urinary systems & electrolytes": "Renal/Urinary & Reproductive",
  "female reproductive system & breast": "Renal/Urinary & Reproductive",
  "male reproductive system": "Renal/Urinary & Reproductive",
  "allergy & immunology": "Immune",
  "hematology & oncology": "Blood & Lymphoreticular",
  "miscellaneous (multisystem)": "Multisystem Processes & Disorders",
  "psychiatric/behavioral & substance use disorder": "Psych/Behavioral & Substance Use",
  "biostatistics & epidemiology": "Biostatistics/Epi/Population Health/Med Lit",
  "social sciences (ethics/legal/professional)": "Social Sciences",
  "ear, nose & throat (ent)": "Nervous System & Special Senses",
  ent: "Nervous System & Special Senses",
  dermatology: "MSK / Skin & Subcutaneous",
  "rheumatology/orthopedics & sports": "MSK / Skin & Subcutaneous",
};

function maybeCanonicalizeUworldSystemLabel(name: string): string {
  const normalized = name.trim().toLowerCase();
  return UWORLD_SYSTEM_CANONICAL_OVERRIDES[normalized] ?? name;
}

function shouldAttemptSplit(name: string): boolean {
  return /\/|&|\sand\s/i.test(name);
}

function getWeightsForStrategy(
  rows: Array<{ categoryType: ParsedRow["categoryType"]; name: string }>,
  testType: TestType,
): number[] {
  return rows.map((row) => getWeightForCategory(row.categoryType, row.name, testType) ?? 0);
}

export function expandCombinedCategories(row: ExtractedRow, testType: TestType): ExtractedRow[] {
  const normalizedRow = normalizeExtractedRow(row);
  if (!shouldAttemptSplit(normalizedRow.name)) {
    return [normalizedRow];
  }

  const total = toNumberOrUndefined(normalizedRow.total);
  const correct = toNumberOrUndefined(normalizedRow.correct);
  if (typeof total !== "number" || typeof correct !== "number" || total <= 0) {
    return [normalizedRow];
  }

  const parts = getSplitParts(normalizedRow.name);
  if (parts.length < 2) {
    return [normalizedRow];
  }

  const mapped = parts
    .map((part) => canonicalizeCategoryName(normalizedRow.categoryType, part, testType))
    .filter((entry) => entry.matchType !== "none" && entry.canonicalName);

  const uniqueNames = Array.from(new Set(mapped.map((entry) => entry.canonicalName as string)));
  if (uniqueNames.length < 2) {
    return [normalizedRow];
  }

  const splitSkeleton = uniqueNames.map((name) => ({
    categoryType: normalizedRow.categoryType,
    name,
  }));

  const weightShares = getWeightsForStrategy(splitSkeleton, testType);
  const canUseWeightStrategy = weightShares.every((weight) => weight > 0);
  const strategyShares = canUseWeightStrategy ? weightShares : splitSkeleton.map(() => 1);
  const strategyLabel = canUseWeightStrategy ? "weight" : "equal";

  const totalAllocations = allocateIntegerShares(total, strategyShares);
  const correctAllocations = rebalanceCorrectAgainstTotals(allocateIntegerShares(correct, strategyShares), totalAllocations);

  const expandedRows: ExtractedRow[] = splitSkeleton.map((rowInfo, index) => {
    const rowTotal = totalAllocations[index];
    const rowCorrect = correctAllocations[index];
    const percentCorrect = rowTotal > 0 ? clamp01(rowCorrect / rowTotal) : undefined;
    return {
      categoryType: rowInfo.categoryType,
      name: rowInfo.name,
      total: rowTotal,
      correct: rowCorrect,
      percentCorrect,
      confidence: normalizedRow.confidence,
    };
  });

  if (process.env.NODE_ENV === "development") {
    const allocations = expandedRows.map((entry) => `${entry.name}(${entry.correct}/${entry.total})`).join(", ");
    console.log(
      `[normalizeExtract] split "${normalizedRow.name}" -> [${allocations}] using ${strategyLabel} strategy`,
    );
  }

  return expandedRows;
}

function buildParsedRow(
  row: ExtractedRow,
  testType: TestType,
  source: QbankSource = "unknown",
  inputSource: InputSource = "unknown",
): { parsedRow?: ParsedRow; warning?: string; missingRequired: boolean } {
  const normalizedRow = normalizeExtractedRow(row);
  const rawNameForMatch = normalizedRow.mappedCanonicalName?.trim() || normalizedRow.name;
  const nameForMatch =
    normalizedRow.categoryType === "uworld_system"
      ? maybeCanonicalizeUworldSystemLabel(rawNameForMatch)
      : rawNameForMatch;
  const matched = canonicalizeCategoryName(normalizedRow.categoryType, nameForMatch, testType, source);
  const canonicalName = matched.canonicalName;
  const displayName = canonicalName ?? normalizedRow.name;
  const total = toNumberOrUndefined(normalizedRow.total);
  let correct = toNumberOrUndefined(normalizedRow.correct);
  let incorrectCount = toIntOrUndefined(normalizedRow.incorrectCount);
  const omittedCount = toIntOrUndefined(normalizedRow.omittedCount);
  const usageUsed = toIntOrUndefined(normalizedRow.usageUsed);
  const usageTotal = toIntOrUndefined(normalizedRow.usageTotal);
  const percentCorrect = toNumberOrUndefined(normalizedRow.percentCorrect);
  const proxyWeakness = normalizeProxyWeakness(normalizedRow.proxyWeakness);
  const hasPartialQbank = typeof correct === "number" || (typeof total === "number" && total > 0);

  if (typeof total === "number" && total <= 0) {
    return {
      warning: `${displayName}: total must be greater than 0.`,
      missingRequired: true,
    };
  }

  if (typeof correct !== "number" && typeof total === "number" && typeof percentCorrect === "number") {
    correct = Math.round(percentCorrect * total);
  }

  // If incorrectCount is missing but we have correct + percentCorrect, derive attempted/incorrect.
  if (
    incorrectCount == null &&
    typeof correct === "number" &&
    Number.isFinite(correct) &&
    correct >= 0 &&
    typeof percentCorrect === "number" &&
    Number.isFinite(percentCorrect) &&
    percentCorrect > 0 &&
    percentCorrect <= 1
  ) {
    let attempted = Math.round(correct / percentCorrect);
    if (attempted < correct) {
      attempted = Math.ceil(correct);
    }
    incorrectCount = attempted - correct;
  }

  const hasQbankMetrics =
    typeof correct === "number" &&
    typeof incorrectCount === "number" &&
    incorrectCount >= 0;
  if (!hasQbankMetrics && typeof proxyWeakness !== "number" && !hasPartialQbank) {
    return {
      warning: `${displayName}: missing both QBank metrics and score-report proxy weakness.`,
      missingRequired: true,
    };
  }

  let qbankTotal: number | undefined;
  let qbankCorrect: number | undefined;
  let qbankIncorrect: number | undefined;
  let accuracy: number | undefined;

  if (hasQbankMetrics) {
    const safeCorrect = correct as number;
    const safeTotal = safeCorrect + (incorrectCount as number);

    if (safeCorrect > safeTotal) {
      return {
        warning: `${displayName}: correct must be between 0 and total.`,
        missingRequired: true,
      };
    }

    qbankTotal = safeTotal;
    qbankCorrect = safeCorrect;
    qbankIncorrect = incorrectCount as number;
    const computedAccuracy = computeAccuracy(qbankCorrect, qbankIncorrect);
    accuracy = computedAccuracy == null ? undefined : computedAccuracy;
  } else if (hasPartialQbank) {
    qbankCorrect = typeof correct === "number" ? correct : undefined;
    qbankTotal = typeof total === "number" ? total : undefined;
  }
  const weight = canonicalName ? getWeightForCategory(row.categoryType, canonicalName, testType) : null;
  const roi = typeof accuracy === "number" ? (1 - accuracy) * (weight ?? 0) : null;
  const proi = typeof proxyWeakness === "number" ? proxyWeakness * (weight ?? 0) : 0;

  if (process.env.NODE_ENV === "development") {
    console.log(
      `[normalizeExtract] ${normalizedRow.categoryType}: "${normalizedRow.name}" -> "${canonicalName ?? "UNMAPPED"}" (score=${matched.matchScore.toFixed(3)}, matchType=${matched.matchType})`,
    );
  }

  return {
    parsedRow: {
      categoryType: normalizedRow.categoryType,
      source,
      inputSource,
      name: canonicalName ?? normalizedRow.name,
      canonicalName,
      testType,
      correct: qbankCorrect,
      incorrectCount: qbankIncorrect,
      omittedCount,
      usageUsed,
      usageTotal,
      total: qbankTotal,
      accuracy,
      weight,
      roi,
      proxyWeakness,
      proi,
      originalName: normalizedRow.name,
      matchType: matched.matchType,
      matchScore: matched.matchScore,
      unmapped: matched.matchType === "none" || weight == null,
    },
    warning:
      matched.matchType === "none" || weight == null
        ? `${normalizedRow.name}: not confidently mapped; excluded from weighted ranking.`
        : undefined,
    missingRequired: false,
  };
}

export function normalizeExtractRows(
  rows: ExtractedRow[],
  testType: TestType,
  source: QbankSource = "unknown",
  inputSource: InputSource = "unknown",
): NormalizedExtractResult {
  const warnings: string[] = [];
  const parsedRows: ParsedRow[] = [];
  let hasMissingRequired = false;

  for (const row of rows) {
    const expandedRows = expandCombinedCategories(row, testType);

    for (const expandedRow of expandedRows) {
      const result = buildParsedRow(expandedRow, testType, source, inputSource);
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
  }

  return {
    parsedRows,
    warnings,
    hasMissingRequired,
  };
}
