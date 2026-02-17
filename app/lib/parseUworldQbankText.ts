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

function toInt(value: string | undefined): number {
  if (!value) {
    return 0;
  }
  const parsed = Number.parseInt(value.replace(/,/g, ""), 10);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function parseCounts(
  line: string,
): {
  correct: number;
  incorrect: number;
  omittedCount?: number;
  usageUsed?: number;
  usageTotal?: number;
  uiCorrectPct?: number;
} | null {
  const usageMatch = line.match(/usage\s+(\d[\d,]*)\s*\/\s*(\d[\d,]*)/i);
  const correctMatch = line.match(/correct\s*q?\s+(\d[\d,]*)(?:\s*\(([\d.]+)%\))?/i);
  const incorrectMatch = line.match(/incorrect\s*q?\s+(\d[\d,]*)(?:\s*\(([\d.]+)%\))?/i);
  const omittedMatch = line.match(/omitted\s*q?\s+(\d[\d,]*)(?:\s*\(([\d.]+)%\))?/i);

  if (correctMatch && incorrectMatch) {
    return {
      usageUsed: usageMatch ? toInt(usageMatch[1]) : undefined,
      usageTotal: usageMatch ? toInt(usageMatch[2]) : undefined,
      correct: toInt(correctMatch[1]),
      incorrect: toInt(incorrectMatch[1]),
      omittedCount: omittedMatch ? toInt(omittedMatch[1]) : undefined,
      uiCorrectPct:
        typeof correctMatch[2] === "string" && correctMatch[2].length > 0
          ? Number.parseFloat(correctMatch[2])
          : undefined,
    };
  }

  // Fallback for partially structured OCR lines.
  const numeric = (line.match(/\d[\d,]*/g) ?? []).map((value) => Number.parseInt(value.replace(/,/g, ""), 10));
  if (numeric.length < 2) {
    return null;
  }
  return {
    correct: Math.max(0, numeric[0] ?? 0),
    incorrect: Math.max(0, numeric[1] ?? 0),
  };
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

      const parsed = parseCounts(candidateLine);
      if (!parsed) {
        continue;
      }

      const total = parsed.correct + parsed.incorrect;
      if (total <= 0) {
        if (process.env.NODE_ENV !== "production" && (parsed.usageUsed ?? 0) > 0) {
          console.warn(
            `[uworld-parse] counts missing for "${labelMatch.canonicalName}" (usage=${parsed.usageUsed}/${parsed.usageTotal ?? 0})`,
          );
        }
        continue;
      }

      if (
        process.env.NODE_ENV !== "production" &&
        typeof parsed.uiCorrectPct === "number" &&
        Number.isFinite(parsed.uiCorrectPct)
      ) {
        const computedPct = (parsed.correct / total) * 100;
        if (Math.abs(computedPct - parsed.uiCorrectPct) > 5) {
          console.warn(
            `[uworld-parse] percent mismatch for "${labelMatch.canonicalName}": ui=${parsed.uiCorrectPct.toFixed(1)} computed=${computedPct.toFixed(1)}`,
          );
        }
      }

      const row: ExtractedRow = {
        categoryType: labelMatch.categoryType,
        name: labelMatch.canonicalName,
        correct: parsed.correct,
        incorrectCount: parsed.incorrect,
        omittedCount: parsed.omittedCount,
        usageUsed: parsed.usageUsed,
        usageTotal: parsed.usageTotal,
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
