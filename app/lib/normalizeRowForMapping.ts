import { getWeightForCategory } from "./blueprint";
import { canonicalizeCategoryName, recoverCategoryTypeForComlex2 } from "./nameMatching";
import type { ParsedRow, CategoryType, TestType } from "./types";

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

function normalizeAccuracy(row: ParsedRow): number | undefined {
  if (typeof row.accuracy === "number") {
    return row.accuracy;
  }
  if (typeof row.correct === "number" && typeof row.total === "number" && row.total > 0) {
    return row.correct / row.total;
  }
  return undefined;
}

export function normalizeRowForMapping(testType: TestType, row: ParsedRow): ParsedRow {
  const originalName = row.originalName ?? row.name;
  const originalType = String(row.categoryType);
  const recoveredTypeRaw = recoverCategoryTypeForComlex2(testType, String(row.categoryType), originalName);

  if (
    process.env.NODE_ENV !== "production" &&
    testType === "comlex2" &&
    originalType !== recoveredTypeRaw &&
    originalType.toLowerCase().includes("unknown")
  ) {
    console.log(`[recoverType] comlex2 "${originalType}" -> "${recoveredTypeRaw}" "${originalName}"`);
  }

  if (!isCategoryType(recoveredTypeRaw)) {
    return {
      ...row,
      testType,
      originalName,
      unmapped: true,
      weight: null,
      matchType: "none",
      matchScore: 0,
    };
  }

  const matched = canonicalizeCategoryName(recoveredTypeRaw, originalName, testType, row.source ?? "unknown");
  const canonicalName = matched.canonicalName;
  const weight = canonicalName ? getWeightForCategory(recoveredTypeRaw, canonicalName, testType) : null;
  const accuracy = normalizeAccuracy(row);
  const roi = typeof accuracy === "number" ? (1 - accuracy) * (weight ?? 0) : 0;
  const proi =
    typeof row.proxyWeakness === "number"
      ? row.proxyWeakness * (weight ?? 0)
      : typeof row.proi === "number"
        ? row.proi
        : undefined;
  const inferredInputSource =
    row.inputSource ??
    (testType === "usmle_step2" && (recoveredTypeRaw === "uworld_subject" || recoveredTypeRaw === "uworld_system")
      ? "uworld_qbank"
      : undefined);

  return {
    ...row,
    testType,
    categoryType: recoveredTypeRaw,
    name: canonicalName ?? originalName,
    canonicalName,
    originalName,
    accuracy,
    weight,
    roi,
    proi,
    inputSource: inferredInputSource,
    matchType: matched.matchType,
    matchScore: matched.matchScore,
    unmapped: matched.matchType === "none" || weight == null,
  };
}
