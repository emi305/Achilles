import { getCategoryCandidates } from "./blueprint";
import { MAPPING_CATALOG, type QbankSource } from "./mappingCatalog";
import type { CategoryType, TestType } from "./types";

export type MatchResult = {
  canonicalName: string | null;
  matchType: "exact" | "alias" | "regex" | "fuzzy" | "none";
  matchScore: number;
};

const MATCH_THRESHOLD = 0.84;

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/[|]/g, "l")
    .replace(/[^a-z0-9\s/&:()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComlexClinicalPresentation(raw: string): string {
  let normalized = raw
    .replace(/\bpatient presentations? related to (the )?/gi, "")
    .replace(/\bpatient presentation related to (the )?/gi, "")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\bsystems\b/g, "system")
    .replace(/\s+/g, " ")
    .trim();

  // Keep the wellness canonical phrase matchable from shortened NBOME/TrueLearn labels.
  if (normalized === "community health") {
    normalized = "community health and wellness";
  }

  return normalized;
}

function getNormalizedCandidates(
  rawName: string,
  categoryType: CategoryType,
  testType: TestType,
): string[] {
  const base = normalizeForMatch(rawName);
  const candidates = new Set<string>();

  if (base) {
    candidates.add(base);
  }

  if (testType === "comlex2" && categoryType === "clinical_presentation") {
    const stripped = normalizeForMatch(normalizeComlexClinicalPresentation(rawName));
    if (stripped) {
      candidates.add(stripped);
      candidates.add(stripped.replace(/\bsystems\b/g, "system"));
      candidates.add(stripped.replace(/\b(system)\b/g, "systems"));
    }
  }

  return Array.from(candidates);
}

function simplifyForSimilarity(name: string): string {
  return normalizeForMatch(name)
    .replace(/\b(patient|presentations|presentation|related|to|the|and|of)\b/g, " ")
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

function getCatalog(testType: TestType, categoryType: CategoryType) {
  return MAPPING_CATALOG[testType]?.[categoryType] ?? {};
}

function tryRegexMatch(catalog: ReturnType<typeof getCatalog>, rawNormalized: string): MatchResult | null {
  for (const [canonicalName, meta] of Object.entries(catalog)) {
    if (!meta) {
      continue;
    }
    const regexPatterns = meta.regex ?? [];
    for (const pattern of regexPatterns) {
      try {
        const re = new RegExp(pattern, "i");
        if (re.test(rawNormalized)) {
          return { canonicalName, matchType: "regex", matchScore: 0.95 };
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function tryAliasMatch(
  catalog: ReturnType<typeof getCatalog>,
  normalizedCandidates: string[],
  source: QbankSource,
): MatchResult | null {
  for (const [canonicalName, meta] of Object.entries(catalog)) {
    if (!meta) {
      continue;
    }
    const sourceAliases = meta.bySource?.[source] ?? [];
    for (const alias of sourceAliases) {
      if (normalizedCandidates.includes(normalizeForMatch(alias))) {
        return { canonicalName, matchType: "alias", matchScore: 1 };
      }
    }
  }

  for (const [canonicalName, meta] of Object.entries(catalog)) {
    if (!meta) {
      continue;
    }
    for (const alias of meta.aliases) {
      if (normalizedCandidates.includes(normalizeForMatch(alias))) {
        return { canonicalName, matchType: "alias", matchScore: 0.98 };
      }
    }
  }

  return null;
}

export function canonicalizeCategoryName(
  categoryType: CategoryType,
  rawName: string,
  testType: TestType,
  source: QbankSource = "unknown",
): MatchResult {
  if (!testType) {
    throw new Error("canonicalizeCategoryName requires testType.");
  }

  const trimmed = rawName.trim();
  if (!trimmed) {
    return { canonicalName: null, matchType: "none", matchScore: 0 };
  }

  const normalizedCandidates = getNormalizedCandidates(trimmed, categoryType, testType);
  const catalog = getCatalog(testType, categoryType);

  for (const canonicalName of Object.keys(catalog)) {
    if (normalizedCandidates.includes(normalizeForMatch(canonicalName))) {
      return { canonicalName, matchType: "exact", matchScore: 1 };
    }
  }

  const aliasMatch = tryAliasMatch(catalog, normalizedCandidates, source);
  if (aliasMatch) {
    return aliasMatch;
  }

  for (const candidate of normalizedCandidates) {
    const regexMatch = tryRegexMatch(catalog, candidate);
    if (regexMatch) {
      return regexMatch;
    }
  }

  // Fuzzy fallback remains strictly within same exam + categoryType canonical candidates.
  const candidates = getCategoryCandidates(categoryType, testType);
  let bestName: string | null = null;
  let bestScore = 0;
  const similarityRaw = simplifyForSimilarity(trimmed);

  for (const candidate of candidates) {
    const score = similarity(similarityRaw, simplifyForSimilarity(candidate));
    if (score > bestScore) {
      bestScore = score;
      bestName = candidate;
    }
  }

  if (bestName && bestScore >= MATCH_THRESHOLD) {
    return { canonicalName: bestName, matchType: "fuzzy", matchScore: bestScore };
  }

  return { canonicalName: null, matchType: "none", matchScore: bestScore };
}
