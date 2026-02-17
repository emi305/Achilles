import { MAPPING_CATALOG } from "./mappingCatalog";
import type { ExtractedRow } from "./types";

type UworldCategory = "uworld_subject" | "uworld_system";

type MatchedLabel = {
  categoryType: UworldCategory;
  canonicalName: string;
  matchedLength: number;
};

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\u00A0\u200B\u200C\u200D\uFEFF]/g, " ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectLabelCandidates(): Array<{ categoryType: UworldCategory; canonicalName: string; normalized: string }> {
  const subjectCatalog = MAPPING_CATALOG.usmle_step2.uworld_subject ?? {};
  const systemCatalog = MAPPING_CATALOG.usmle_step2.uworld_system ?? {};
  const candidates: Array<{ categoryType: UworldCategory; canonicalName: string; normalized: string }> = [];

  const addEntries = (categoryType: UworldCategory, catalog: typeof subjectCatalog) => {
    for (const [canonicalName, meta] of Object.entries(catalog)) {
      const names = new Set<string>([canonicalName, ...(meta?.aliases ?? [])]);
      for (const label of names) {
        const normalized = normalizeForMatch(label);
        if (normalized) {
          candidates.push({ categoryType, canonicalName, normalized });
        }
      }
    }
  };

  addEntries("uworld_subject", subjectCatalog);
  addEntries("uworld_system", systemCatalog);
  return candidates;
}

const LABEL_CANDIDATES = collectLabelCandidates().sort((a, b) => b.normalized.length - a.normalized.length);

function findBestLabelMatch(normalizedLine: string): MatchedLabel | null {
  let best: MatchedLabel | null = null;

  for (const candidate of LABEL_CANDIDATES) {
    if (!normalizedLine.includes(candidate.normalized)) {
      continue;
    }
    if (!best || candidate.normalized.length > best.matchedLength) {
      best = {
        categoryType: candidate.categoryType,
        canonicalName: candidate.canonicalName,
        matchedLength: candidate.normalized.length,
      };
    }
  }

  return best;
}

function parseCorrectIncorrect(line: string): { correct: number; incorrect: number } | null {
  const numeric = (line.match(/\d+/g) ?? []).map(Number);
  if (numeric.length < 2) {
    return null;
  }

  if (numeric.length >= 3) {
    const correct = numeric[1] ?? 0;
    const incorrect = numeric[2] ?? 0;
    if (correct >= 0 && incorrect >= 0) {
      return { correct, incorrect };
    }
  }

  const correct = numeric[0] ?? 0;
  const incorrect = numeric[1] ?? 0;
  if (correct >= 0 && incorrect >= 0) {
    return { correct, incorrect };
  }

  return null;
}

export function parseUworldQbankText(rawText: string): ExtractedRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const bestByKey = new Map<string, ExtractedRow>();

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index] ?? "";
    const combined = index + 1 < lines.length ? `${current} ${lines[index + 1]}` : current;
    const lineCandidates = [current, combined];

    for (const candidateLine of lineCandidates) {
      const normalized = normalizeForMatch(candidateLine);
      if (!normalized) {
        continue;
      }
      const labelMatch = findBestLabelMatch(normalized);
      if (!labelMatch) {
        continue;
      }

      const parsed = parseCorrectIncorrect(candidateLine);
      if (!parsed) {
        continue;
      }

      const total = parsed.correct + parsed.incorrect;
      if (total <= 0) {
        continue;
      }

      const row: ExtractedRow = {
        categoryType: labelMatch.categoryType,
        name: labelMatch.canonicalName,
        correct: parsed.correct,
        total,
        confidence: 0.95,
      };
      const key = `${row.categoryType}::${row.name}`;
      const existing = bestByKey.get(key);
      if (!existing || (existing.total ?? 0) < total) {
        bestByKey.set(key, row);
      }
      break;
    }
  }

  return Array.from(bestByKey.values());
}

