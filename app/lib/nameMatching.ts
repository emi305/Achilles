import { getCategoryCandidates } from "./blueprint";
import { MAPPING_CATALOG, type QbankSource } from "./mappingCatalog";
import { sanitizeCategoryLabel } from "./textSanitize";
import type { CategoryType, TestType } from "./types";

export type MatchResult = {
  canonicalName: string | null;
  matchType: "exact" | "alias" | "regex" | "fuzzy" | "none";
  matchScore: number;
};

type PreparedEntry = {
  canonicalName: string;
  canonicalSanitized: string;
  sourceAliasSanitized: Partial<Record<QbankSource, string[]>>;
  aliasSanitized: string[];
  regexes: RegExp[];
};

const MATCH_THRESHOLD = 0.84;
const preparedCatalogCache = new Map<string, PreparedEntry[]>();
const KNOWN_CATEGORY_TYPES: CategoryType[] = [
  "competency_domain",
  "clinical_presentation",
  "discipline",
  "system",
  "physician_task",
  "uworld_subject",
  "uworld_system",
];

function isCategoryType(value: string): value is CategoryType {
  return KNOWN_CATEGORY_TYPES.includes(value as CategoryType);
}

function preprocessForExamSpecificMatching(
  sanitized: string,
  categoryType: CategoryType,
  testType: TestType,
): string {
  if (testType === "comlex2" && categoryType === "clinical_presentation") {
    let value = sanitized
      .replace(/^patient presentations? related to (the )?/, "")
      .replace(/^patient presentation related to (the )?/, "")
      .replace(/\bsystems\b/g, "system")
      .trim();

    if (value === "community health") {
      value = "community health and wellness";
    }
    return value;
  }

  if (testType === "comlex2" && categoryType === "competency_domain") {
    return sanitized
      .replace(/\s+in osteopathic medicine$/, "")
      .replace(/\s+in osteopathic medical practice$/, "")
      .replace(/\s+for osteopathic medical practice$/, "")
      .trim();
  }

  return sanitized;
}

function getPreparedCatalog(testType: TestType, categoryType: CategoryType): PreparedEntry[] {
  const cacheKey = `${testType}::${categoryType}`;
  const cached = preparedCatalogCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const catalog = MAPPING_CATALOG[testType]?.[categoryType] ?? {};
  const prepared: PreparedEntry[] = Object.entries(catalog).map(([canonicalName, meta]) => {
    const sourceAliasSanitized: Partial<Record<QbankSource, string[]>> = {};
    const bySource = meta?.bySource ?? {};

    for (const source of Object.keys(bySource) as QbankSource[]) {
      sourceAliasSanitized[source] = (bySource[source] ?? []).map((alias) =>
        preprocessForExamSpecificMatching(sanitizeCategoryLabel(alias), categoryType, testType),
      );
    }

    const regexes = (meta?.regex ?? []).flatMap((pattern) => {
      try {
        return [new RegExp(pattern, "i")];
      } catch {
        return [];
      }
    });

    return {
      canonicalName,
      canonicalSanitized: preprocessForExamSpecificMatching(
        sanitizeCategoryLabel(canonicalName),
        categoryType,
        testType,
      ),
      sourceAliasSanitized,
      aliasSanitized: (meta?.aliases ?? []).map((alias) =>
        preprocessForExamSpecificMatching(sanitizeCategoryLabel(alias), categoryType, testType),
      ),
      regexes,
    };
  });

  preparedCatalogCache.set(cacheKey, prepared);
  return prepared;
}

function getNormalizedCandidates(rawName: string, categoryType: CategoryType, testType: TestType): string[] {
  const base = preprocessForExamSpecificMatching(sanitizeCategoryLabel(rawName), categoryType, testType);
  const candidates = new Set<string>();

  if (base) {
    candidates.add(base);
  }

  if (testType === "comlex2" && categoryType === "clinical_presentation" && base) {
    candidates.add(base.replace(/\bsystems\b/g, "system"));
    candidates.add(base.replace(/\b(system)\b/g, "systems"));
  }

  return Array.from(candidates);
}

function simplifyForSimilarity(name: string): string {
  return sanitizeCategoryLabel(name)
    .replace(/\b(patient|presentations|presentation|related|to|the|and|of)\b/g, " ")
    .replace(/rn/g, "m")
    .replace(/[|]/g, "l")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0) return bLen;
  if (bLen === 0) return aLen;

  const matrix: number[][] = Array.from({ length: aLen + 1 }, () => Array(bLen + 1).fill(0));
  for (let i = 0; i <= aLen; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= bLen; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= aLen; i += 1) {
    for (let j = 1; j <= bLen; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
    }
  }

  return matrix[aLen][bLen];
}

function similarity(a: string, b: string): number {
  if (!a || !b) {
    return 0;
  }
  if (a === b) {
    return 1;
  }
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

function tryRegexMatch(preparedCatalog: PreparedEntry[], rawNormalized: string): MatchResult | null {
  for (const entry of preparedCatalog) {
    for (const re of entry.regexes) {
      if (re.test(rawNormalized)) {
        return { canonicalName: entry.canonicalName, matchType: "regex", matchScore: 0.95 };
      }
    }
  }
  return null;
}

function tryAliasMatch(
  preparedCatalog: PreparedEntry[],
  normalizedCandidates: string[],
  source: QbankSource,
): MatchResult | null {
  for (const entry of preparedCatalog) {
    const sourceAliases = entry.sourceAliasSanitized[source] ?? [];
    for (const alias of sourceAliases) {
      if (normalizedCandidates.includes(alias)) {
        return { canonicalName: entry.canonicalName, matchType: "alias", matchScore: 1 };
      }
    }
  }

  for (const entry of preparedCatalog) {
    for (const alias of entry.aliasSanitized) {
      if (normalizedCandidates.includes(alias)) {
        return { canonicalName: entry.canonicalName, matchType: "alias", matchScore: 0.98 };
      }
    }
  }

  return null;
}

function maybeLogUworldCanonicalization(
  testType: TestType,
  categoryType: string,
  rawName: string,
  canonicalName: string | null,
) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (testType !== "usmle_step2") {
    return;
  }
  if (categoryType !== "uworld_subject" && categoryType !== "uworld_system") {
    return;
  }
  if (!canonicalName) {
    return;
  }
  const rawSanitized = sanitizeCategoryLabel(rawName);
  const canonicalSanitized = sanitizeCategoryLabel(canonicalName);
  if (rawSanitized !== canonicalSanitized) {
    console.log(`[uworldCanon] usmle2 ${categoryType} "${rawName}" -> "${canonicalName}"`);
  }
}

export function canonicalizeCategoryName(
  categoryType: CategoryType | string,
  rawName: string,
  testType: TestType,
  source: QbankSource = "unknown",
): MatchResult {
  if (!testType) {
    throw new Error("canonicalizeCategoryName requires testType.");
  }

  const recoveredType = recoverCategoryTypeForComlex2(testType, categoryType, rawName);
  if (!isCategoryType(recoveredType)) {
    return { canonicalName: null, matchType: "none", matchScore: 0 };
  }

  if (
    process.env.NODE_ENV === "development" &&
    testType === "comlex2" &&
    categoryType !== recoveredType &&
    String(categoryType).toLowerCase().includes("unknown")
  ) {
    console.log(`[recoverType] comlex2 "${categoryType}" -> "${recoveredType}" for "${rawName}"`);
  }

  const normalizedCandidates = getNormalizedCandidates(rawName, recoveredType, testType);
  if (normalizedCandidates.length === 0) {
    return { canonicalName: null, matchType: "none", matchScore: 0 };
  }

  const preparedCatalog = getPreparedCatalog(testType, recoveredType);

  for (const entry of preparedCatalog) {
    if (normalizedCandidates.includes(entry.canonicalSanitized)) {
      maybeLogUworldCanonicalization(testType, recoveredType, rawName, entry.canonicalName);
      return { canonicalName: entry.canonicalName, matchType: "exact", matchScore: 1 };
    }
  }

  const aliasMatch = tryAliasMatch(preparedCatalog, normalizedCandidates, source);
  if (aliasMatch) {
    maybeLogUworldCanonicalization(testType, recoveredType, rawName, aliasMatch.canonicalName);
    return aliasMatch;
  }

  for (const candidate of normalizedCandidates) {
    const regexMatch = tryRegexMatch(preparedCatalog, candidate);
    if (regexMatch) {
      maybeLogUworldCanonicalization(testType, recoveredType, rawName, regexMatch.canonicalName);
      return regexMatch;
    }
  }

  // Fuzzy fallback remains strictly within same exam + categoryType canonical candidates.
  const candidates = getCategoryCandidates(recoveredType, testType);
  let bestName: string | null = null;
  let bestScore = 0;
  const similarityRawCandidates = normalizedCandidates.map((value) => simplifyForSimilarity(value)).filter(Boolean);

  for (const candidate of candidates) {
    const candidateSimplified = simplifyForSimilarity(candidate);
    const score = Math.max(
      ...similarityRawCandidates.map((similarityRaw) => similarity(similarityRaw, candidateSimplified)),
      0,
    );
    if (score > bestScore) {
      bestScore = score;
      bestName = candidate;
    }
  }

  if (bestName && bestScore >= MATCH_THRESHOLD) {
    maybeLogUworldCanonicalization(testType, recoveredType, rawName, bestName);
    return { canonicalName: bestName, matchType: "fuzzy", matchScore: bestScore };
  }

  return { canonicalName: null, matchType: "none", matchScore: bestScore };
}

export function recoverCategoryTypeForComlex2(
  testType: TestType,
  rawCategoryType: string,
  rawLabel: string,
): string {
  if (testType !== "comlex2") {
    return rawCategoryType;
  }

  const categoryToken = sanitizeCategoryLabel(rawCategoryType).replace(/\s+/g, "_");
  if (!categoryToken.includes("unknown")) {
    return rawCategoryType;
  }

  const sanitizedLabel = sanitizeCategoryLabel(rawLabel);
  if (!sanitizedLabel) {
    return rawCategoryType;
  }

  const orderedCandidates: CategoryType[] = [
    "competency_domain",
    "clinical_presentation",
    "discipline",
    "system",
    "physician_task",
  ];

  for (const candidateType of orderedCandidates) {
    const attempt = canonicalizeCategoryName(candidateType, rawLabel, testType, "unknown");
    if (attempt.matchType !== "none" && attempt.canonicalName) {
      return candidateType;
    }
  }

  return rawCategoryType;
}
