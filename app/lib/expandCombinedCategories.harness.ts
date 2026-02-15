import { canonicalizeCategoryName } from "./nameMatching";
import { expandCombinedCategories, normalizeExtractRows } from "./normalizeExtract";
import type { ExtractedRow } from "./types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Harness assertion failed: ${message}`);
  }
}

export function runExpandCombinedCategoriesHarness() {
  const combined: ExtractedRow = {
    categoryType: "clinical_presentation",
    name: "Genitourinary/Renal System and Breasts",
    correct: 70,
    total: 100,
    confidence: 0.9,
  };

  const splitRows = expandCombinedCategories(combined);
  assert(splitRows.length >= 2, "combined row should split into multiple canonical rows");
  assert(
    splitRows.reduce((sum, row) => sum + (row.total ?? 0), 0) === 100,
    "split totals should preserve original total",
  );
  assert(
    splitRows.reduce((sum, row) => sum + (row.correct ?? 0), 0) === 70,
    "split correct counts should preserve original correct",
  );

  const direct = canonicalizeCategoryName("clinical_presentation", "Respiratory System");
  assert(
    direct.canonicalName === "Patient Presentations Related to the Respiratory System",
    "respiratory should map directly",
  );

  const tricky = canonicalizeCategoryName("clinical_presentation", "integumantary system");
  assert(
    tricky.canonicalName === "Patient Presentations Related to the Integumentary System",
    "ocr variant should fuzzy-map to integumentary",
  );

  const normalized = normalizeExtractRows([combined]);
  assert(normalized.parsedRows.length >= 2, "normalized rows should include split rows");
  assert(
    normalized.parsedRows.every((row) => row.weight > 0 || row.unmapped),
    "split rows should map to weighted keys where possible",
  );

  return {
    splitRows,
    direct,
    tricky,
    normalized,
  };
}
