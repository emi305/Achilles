import { getCategoryCandidates } from "./blueprint";
import type { CategoryType, TestType } from "./types";

type MatchResult = {
  canonicalName: string;
  score: number;
  unmapped: boolean;
};

const MATCH_THRESHOLD = 0.82;

const COMLEX_ALIASES: Record<string, string> = {
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
  genitourinary: "Patient Presentations Related to the Genitourinary System",
  renal: "Patient Presentations Related to the Genitourinary System",
  urinary: "Patient Presentations Related to the Genitourinary System",
  breast: "Patient Presentations Related to Human Development, Reproduction, and Sexuality",
  breasts: "Patient Presentations Related to Human Development, Reproduction, and Sexuality",
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

const STEP2_ALIASES: Record<string, string> = {
  medicine: "Medicine",
  med: "Medicine",
  im: "Medicine",
  "internal med": "Medicine",
  "internal medicine": "Medicine",
  "medicine internal": "Medicine",
  "adult medicine": "Medicine",
  obgyn: "Obstetrics & Gynecology",
  "ob/gyn": "Obstetrics & Gynecology",
  "ob gyn": "Obstetrics & Gynecology",
  "ob gyn ": "Obstetrics & Gynecology",
  obstetrics: "Obstetrics & Gynecology",
  gynecology: "Obstetrics & Gynecology",
  "women s health": "Obstetrics & Gynecology",
  "women health": "Obstetrics & Gynecology",
  gyn: "Obstetrics & Gynecology",
  peds: "Pediatrics",
  psych: "Psychiatry",
  msk: "Musculoskeletal System & Skin",
  musculoskeletal: "Musculoskeletal System & Skin",
  "musculoskeletal skin": "Musculoskeletal System & Skin",
  "msk/derm": "Musculoskeletal System & Skin",
  skin: "Musculoskeletal System & Skin",
  derm: "Musculoskeletal System & Skin",
  dermatology: "Musculoskeletal System & Skin",
  ethics: "Social Sciences (Ethics/Safety/Legal)",
  "patient safety": "Social Sciences (Ethics/Safety/Legal)",
  legal: "Social Sciences (Ethics/Safety/Legal)",
  "quality safety": "Social Sciences (Ethics/Safety/Legal)",
  "quality improvement": "Social Sciences (Ethics/Safety/Legal)",
  qi: "Social Sciences (Ethics/Safety/Legal)",
  communication: "Social Sciences (Ethics/Safety/Legal)",
  professionalism: "Social Sciences (Ethics/Safety/Legal)",
  "social science": "Social Sciences (Ethics/Safety/Legal)",
  "social sciences": "Social Sciences (Ethics/Safety/Legal)",
  social: "Social Sciences (Ethics/Safety/Legal)",
  renal: "Renal/Urinary & Reproductive",
  gu: "Renal/Urinary & Reproductive",
  genitourinary: "Renal/Urinary & Reproductive",
  urology: "Renal/Urinary & Reproductive",
  urinary: "Renal/Urinary & Reproductive",
  repro: "Renal/Urinary & Reproductive",
  reproductive: "Renal/Urinary & Reproductive",
  "renal/gu": "Renal/Urinary & Reproductive",
  "gu/repro": "Renal/Urinary & Reproductive",
  cardio: "Cardiovascular System",
  cardiovascular: "Cardiovascular System",
  cv: "Cardiovascular System",
  pulm: "Respiratory System",
  pulmonary: "Respiratory System",
  respiratory: "Respiratory System",
  gi: "Gastrointestinal System",
  gastrointestinal: "Gastrointestinal System",
  management: "Patient Care: Management",
  treatment: "Patient Care: Management",
  therapy: "Patient Care: Management",
  intervention: "Patient Care: Management",
  "patient care management": "Patient Care: Management",
  "patient care - management": "Patient Care: Management",
  "patient care: management": "Patient Care: Management",
  "patient care management ": "Patient Care: Management",
  diagnosis: "Patient Care: Diagnosis",
  diagnostic: "Patient Care: Diagnosis",
  workup: "Patient Care: Diagnosis",
  evaluation: "Patient Care: Diagnosis",
  "patient care diagnosis": "Patient Care: Diagnosis",
  "patient care - diagnosis": "Patient Care: Diagnosis",
  "patient care: diagnosis": "Patient Care: Diagnosis",
  prevention: "Health Maintenance & Disease Prevention",
  "health maintenance": "Health Maintenance & Disease Prevention",
  screening: "Health Maintenance & Disease Prevention",
  counseling: "Health Maintenance & Disease Prevention",
};

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/rn/g, "m")
    .replace(/[|]/g, "l")
    .replace(/[^a-z0-9\s/&:()-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  if (maxLen === 0) {
    return 1;
  }
  return 1 - distance / maxLen;
}

function getAliasMap(testType: TestType): Record<string, string> {
  return testType === "usmle_step2" ? STEP2_ALIASES : COMLEX_ALIASES;
}

type FuzzyCandidate = {
  source: string;
  canonicalName: string;
};

function getFuzzyCandidates(categoryType: CategoryType, testType: TestType): FuzzyCandidate[] {
  const canonicalCandidates = getCategoryCandidates(categoryType, testType);
  const allowedCanonical = new Set(canonicalCandidates);
  const fuzzyCandidates: FuzzyCandidate[] = canonicalCandidates.map((canonicalName) => ({
    source: canonicalName,
    canonicalName,
  }));

  const aliasMap = getAliasMap(testType);
  for (const [alias, canonicalName] of Object.entries(aliasMap)) {
    if (!allowedCanonical.has(canonicalName)) {
      continue;
    }
    fuzzyCandidates.push({
      source: alias,
      canonicalName,
    });
  }

  return fuzzyCandidates;
}

export function canonicalizeCategoryName(
  categoryType: CategoryType,
  rawName: string,
  testType: TestType = "comlex2",
): MatchResult {
  const trimmed = rawName.trim();
  if (!trimmed) {
    return { canonicalName: "", score: 0, unmapped: true };
  }

  const normalizedRaw = normalizeForMatch(trimmed);
  const aliasMatch = getAliasMap(testType)[normalizedRaw];
  if (aliasMatch) {
    return { canonicalName: aliasMatch, score: 1, unmapped: false };
  }

  const candidates = getFuzzyCandidates(categoryType, testType);
  if (candidates.length === 0) {
    return { canonicalName: trimmed, score: 0, unmapped: true };
  }

  const similarityRaw = simplifyForSimilarity(trimmed);
  let bestName = trimmed;
  let bestScore = 0;

  for (const candidate of candidates) {
    const candidateSimplified = simplifyForSimilarity(candidate.source);
    const score = similarity(similarityRaw, candidateSimplified);
    if (score > bestScore) {
      bestScore = score;
      bestName = candidate.canonicalName;
    }
  }

  if (bestScore >= MATCH_THRESHOLD) {
    return { canonicalName: bestName, score: bestScore, unmapped: false };
  }

  return { canonicalName: trimmed, score: bestScore, unmapped: true };
}
