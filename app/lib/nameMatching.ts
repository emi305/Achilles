import {
  CLINICAL_PRESENTATION_WEIGHTS,
  COMPETENCY_DOMAIN_WEIGHTS,
  DISCIPLINE_WEIGHTS,
} from "./comlexWeights";
import type { CategoryType } from "./types";

type MatchResult = {
  canonicalName: string;
  score: number;
  unmapped: boolean;
};

const MATCH_THRESHOLD = 0.82;

const CATEGORY_CANDIDATES: Record<CategoryType, string[]> = {
  discipline: Object.keys(DISCIPLINE_WEIGHTS),
  competency_domain: Object.keys(COMPETENCY_DOMAIN_WEIGHTS),
  clinical_presentation: Object.keys(CLINICAL_PRESENTATION_WEIGHTS),
};

const COMMON_ALIASES: Record<string, string> = {
  im: "Internal Medicine",
  "internal med": "Internal Medicine",
  "internal medicine": "Internal Medicine",
  obgyn: "Obstetrics/Gynecology",
  "ob/gyn": "Obstetrics/Gynecology",
  "ob gyn": "Obstetrics/Gynecology",
  psych: "Psychiatry",
  peds: "Pediatrics",
  ed: "Emergency Medicine",
  em: "Emergency Medicine",
  msk: "Patient Presentations Related to the Musculoskeletal System",
  gi: "Patient Presentations Related to the Gastrointestinal System and Nutritional Health",
  gu: "Patient Presentations Related to the Genitourinary System",
  resp: "Patient Presentations Related to the Respiratory System",
  "respiratory system": "Patient Presentations Related to the Respiratory System",
  "musculoskeletal system": "Patient Presentations Related to the Musculoskeletal System",
  integument: "Patient Presentations Related to the Integumentary System",
  integumentary: "Patient Presentations Related to the Integumentary System",
  "integumantsru system": "Patient Presentations Related to the Integumentary System",
  "heme onc": "Patient Presentations Related to the Circulatory and Hematologic Systems",
  hematology: "Patient Presentations Related to the Circulatory and Hematologic Systems",
  ent: "Patient Presentations Related to the Respiratory System",
  ophtho: "Patient Presentations Related to the Nervous System and Mental Health",
  opp: "Osteopathic Principles and Practice",
  omm: "Osteopathic Principles and Practice",
};

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/[|]/g, "l")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(patient|presentations|presentation|related|to|the|system|practice|and|of)\b/g, " ")
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
  if (maxLen === 0) {
    return 1;
  }
  return 1 - distance / maxLen;
}

export function canonicalizeCategoryName(categoryType: CategoryType, rawName: string): MatchResult {
  const trimmed = rawName.trim();
  const normalizedRaw = normalizeForMatch(trimmed);

  const aliasMatch = COMMON_ALIASES[normalizedRaw];
  if (aliasMatch) {
    return { canonicalName: aliasMatch, score: 1, unmapped: false };
  }

  const candidates = CATEGORY_CANDIDATES[categoryType];
  let bestName = trimmed;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateNormalized = normalizeForMatch(candidate);
    const score = similarity(normalizedRaw, candidateNormalized);
    if (score > bestScore) {
      bestScore = score;
      bestName = candidate;
    }
  }

  if (bestScore >= MATCH_THRESHOLD) {
    return { canonicalName: bestName, score: bestScore, unmapped: false };
  }

  return { canonicalName: trimmed, score: bestScore, unmapped: true };
}
