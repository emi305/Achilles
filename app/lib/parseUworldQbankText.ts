import { MAPPING_CATALOG } from "./mappingCatalog";
import { USMLE2_UWORLD_SUBJECTS_SET, USMLE2_UWORLD_SYSTEMS_SET } from "./usmleStep2UworldCatalog";
import { canonicalizeSubjectLabel, canonicalizeSystemLabel } from "./usmleStep2Canonical";
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
const SUBJECT_FALLBACK_NAMES = new Set<string>([
  ...Array.from(USMLE2_UWORLD_SUBJECTS_SET),
  "Internal Medicine",
  "Obstetrics and Gynecology",
  "OB/GYN",
  "OBGYN",
]);
const SYSTEM_FALLBACK_NAMES = new Set<string>(Array.from(USMLE2_UWORLD_SYSTEMS_SET));
const NORMALIZED_SUBJECT_FALLBACK = new Set<string>(Array.from(SUBJECT_FALLBACK_NAMES, normalizeForMatch));
const NORMALIZED_SYSTEM_FALLBACK = new Set<string>(Array.from(SYSTEM_FALLBACK_NAMES, normalizeForMatch));

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

function extractLabelPrefix(line: string): string | null {
  const match = line.match(/^(.+?)\s+usage\s+\d/i) ?? line.match(/^(.+?)\s+correct\s+q\s+\d/i);
  if (!match || typeof match[1] !== "string") {
    return null;
  }
  const label = match[1].trim();
  return label.length > 0 ? label : null;
}

function detectSectionCategory(line: string): UworldCategory | null {
  const normalized = normalizeForMatch(line);
  if (!normalized) {
    return null;
  }
  const hasSubject = /\bsubjects?\b/.test(normalized);
  const hasSystem = /\bsystems?\b/.test(normalized);
  if (hasSubject && !hasSystem) {
    return "uworld_subject";
  }
  if (hasSystem && !hasSubject) {
    return "uworld_system";
  }
  return null;
}

function classifyCategoryType(
  rowLabel: string,
  fallbackFromMatch: UworldCategory | null,
  sectionCategory: UworldCategory | null,
): UworldCategory | null {
  if (sectionCategory) {
    return sectionCategory;
  }
  const normalizedLabel = normalizeForMatch(rowLabel);
  if (NORMALIZED_SYSTEM_FALLBACK.has(normalizedLabel)) {
    return "uworld_system";
  }
  if (NORMALIZED_SUBJECT_FALLBACK.has(normalizedLabel)) {
    return "uworld_subject";
  }
  return fallbackFromMatch;
}

function toInt(value: string | undefined, rowLabel: string, fieldName: string): number {
  if (!value) {
    return 0;
  }
  const normalized = value.replace(/,/g, "").trim();
  const parsed = Number.parseInt(normalized, 10);
  if (Number.isFinite(parsed)) {
    return Math.max(0, parsed);
  }
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[uworld-parse] failed int parse for "${rowLabel}" ${fieldName}: "${value}"`);
  }
  return 0;
}

function parseCounts(
  line: string,
  rowLabel: string,
): {
  correct: number;
  incorrect: number;
  omittedCount?: number;
  usageUsed?: number;
  usageTotal?: number;
  uiCorrectPct?: number;
} | null {
  const usageMatch = line.match(/usage\s+(\d[\d,]*)\s*\/\s*(\d[\d,]*)/i);
  const correctMatch = line.match(/correct\s+q\s+(\d[\d,]*)(?:\s*\(([\d.]+)%\))?/i);
  const incorrectMatch = line.match(/incorrect\s+q\s+(\d[\d,]*)(?:\s*\(([\d.]+)%\))?/i);
  const omittedMatch = line.match(/omitted\s+q\s+(\d[\d,]*)(?:\s*\(([\d.]+)%\))?/i);

  if (correctMatch && incorrectMatch) {
    return {
      usageUsed: usageMatch ? toInt(usageMatch[1], rowLabel, "usageUsed") : undefined,
      usageTotal: usageMatch ? toInt(usageMatch[2], rowLabel, "usageTotal") : undefined,
      correct: toInt(correctMatch[1], rowLabel, "correct"),
      incorrect: toInt(incorrectMatch[1], rowLabel, "incorrect"),
      omittedCount: omittedMatch ? toInt(omittedMatch[1], rowLabel, "omitted") : undefined,
      uiCorrectPct:
        typeof correctMatch[2] === "string" && correctMatch[2].length > 0
          ? Number.parseFloat(correctMatch[2])
          : undefined,
    };
  }
  return null;
}

export function parseUworldQbankText(rawText: string): ExtractedRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const bestByKey = new Map<string, ExtractedRow>();
  const categoryByNormalizedLabel = new Map<string, UworldCategory>();
  let sectionCategory: UworldCategory | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const current = lines[index] ?? "";
    const sectionFromLine = detectSectionCategory(current);
    if (sectionFromLine) {
      sectionCategory = sectionFromLine;
    }
    const combined = index + 1 < lines.length ? `${current} ${lines[index + 1]}` : current;
    const lineCandidates = [current, combined];

    for (const candidateLine of lineCandidates) {
      const normalized = normalizeForMatch(candidateLine);
      if (!normalized) {
        continue;
      }
      const labelMatch = findBestLabelMatch(normalized);
      const rowLabel = extractLabelPrefix(candidateLine) ?? labelMatch?.canonicalName ?? "";
      const classifiedCategory = classifyCategoryType(rowLabel, labelMatch?.categoryType ?? null, sectionCategory);
      if (!labelMatch && !classifiedCategory) {
        continue;
      }

      const parsed = parseCounts(candidateLine, rowLabel || labelMatch?.canonicalName || "unknown");
      if (!parsed) {
        continue;
      }

      const total = parsed.correct + parsed.incorrect;
      if (total <= 0) {
        if (process.env.NODE_ENV !== "production" && (parsed.usageUsed ?? 0) > 0) {
          console.warn(
            `[uworld-parse] counts missing for "${rowLabel || labelMatch?.canonicalName || "unknown"}" (usage=${parsed.usageUsed}/${parsed.usageTotal ?? 0})`,
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
            `[uworld-parse] percent mismatch for "${rowLabel || labelMatch?.canonicalName || "unknown"}": ui=${parsed.uiCorrectPct.toFixed(1)} computed=${computedPct.toFixed(1)}`,
          );
        }
      }

      const normalizedRowLabel = normalizeForMatch(rowLabel || labelMatch?.canonicalName || "");
      let categoryType = classifiedCategory ?? labelMatch?.categoryType ?? null;
      if (!categoryType) {
        continue;
      }
      if (normalizedRowLabel) {
        const existing = categoryByNormalizedLabel.get(normalizedRowLabel);
        if (existing && existing !== categoryType) {
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              `[uworld-parse] category flip for "${rowLabel}": existing=${existing} next=${categoryType}. Keeping existing.`,
            );
          }
          categoryType = existing;
        } else {
          categoryByNormalizedLabel.set(normalizedRowLabel, categoryType);
        }
      }

      if (process.env.NODE_ENV !== "production") {
        if (normalizedRowLabel && NORMALIZED_SYSTEM_FALLBACK.has(normalizedRowLabel) && categoryType === "uworld_subject") {
          console.error(`[uworld-parse] SYSTEM emitted as subject: "${rowLabel}" | line="${candidateLine}"`);
        }
        if (normalizedRowLabel && NORMALIZED_SUBJECT_FALLBACK.has(normalizedRowLabel) && categoryType === "uworld_system") {
          console.error(`[uworld-parse] SUBJECT emitted as system: "${rowLabel}" | line="${candidateLine}"`);
        }
      }

      const canonicalizedName =
        categoryType === "uworld_system"
          ? canonicalizeSystemLabel(rowLabel || labelMatch?.canonicalName || "").canonical
          : canonicalizeSubjectLabel(rowLabel || labelMatch?.canonicalName || "").canonical;

      const row: ExtractedRow = {
        categoryType,
        name: canonicalizedName,
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
