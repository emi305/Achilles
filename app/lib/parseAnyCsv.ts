import { getWeightForCategory } from "./blueprint";
import { detectSourceFromHeaders } from "./detectSource";
import { canonicalizeCategoryName } from "./nameMatching";
import { detectTemplate } from "./detectTemplate";
import { splitCsvLine } from "./parseCsv";
import type { QbankSource } from "./mappingCatalog";
import type { TemplateId } from "./templates";
import type { CategoryType, ParsedRow, TestType } from "./types";

type ParseAnyOptions = {
  template?: TemplateId;
  defaultCategoryType?: CategoryType;
  testType: TestType;
};

function parseInteger(value: string, label: string, lineNumber: number): number {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid ${label} on line ${lineNumber}. Expected a non-negative integer.`);
  }
  return Number(trimmed);
}

function parsePercentCorrect(value: string, lineNumber: number): number {
  const trimmed = value.trim();
  if (!/^(\d+)(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid PercentCorrect on line ${lineNumber}. Expected a decimal between 0 and 1.`);
  }

  const parsed = Number(trimmed);
  if (parsed < 0 || parsed > 1) {
    throw new Error(`Invalid PercentCorrect on line ${lineNumber}. Expected a decimal between 0 and 1.`);
  }

  return parsed;
}

function parseLines(csvText: string): string[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV input is empty.");
  }

  return lines;
}

function buildRow(
  categoryType: CategoryType,
  name: string,
  correct: number,
  total: number,
  lineNumber: number,
  testType: TestType,
  source: QbankSource,
  incorrectCount?: number,
): ParsedRow {
  if (!name.trim()) {
    throw new Error(`Missing name on line ${lineNumber}.`);
  }

  if (total === 0) {
    throw new Error(`Invalid total on line ${lineNumber}. Total must be greater than 0.`);
  }

  if (correct > total) {
    throw new Error(`Invalid row on line ${lineNumber}. Correct cannot be greater than total.`);
  }

  const matched = canonicalizeCategoryName(categoryType, name, testType, source);
  const canonicalName = matched.canonicalName;
  const attemptedForAccuracy =
    typeof incorrectCount === "number" && incorrectCount >= 0 ? correct + incorrectCount : total;
  const normalizedTotal = attemptedForAccuracy > 0 ? attemptedForAccuracy : total;
  const accuracy = normalizedTotal > 0 ? correct / normalizedTotal : 0;
  const weight = canonicalName ? getWeightForCategory(categoryType, canonicalName, testType) : null;
  const roi = (1 - accuracy) * (weight ?? 0);

  return {
    testType,
    source,
    categoryType,
    name: canonicalName ?? name,
    canonicalName,
    originalName: name,
    matchType: matched.matchType,
    matchScore: matched.matchScore,
    unmapped: matched.matchType === "none" || weight == null,
    correct,
    incorrectCount,
    total: normalizedTotal,
    accuracy,
    weight,
    roi,
  };
}

function parseAchillesSimple(lines: string[], testType: TestType, source: QbankSource): ParsedRow[] {
  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = splitCsvLine(lines[index]);

    if (parts.length !== 4) {
      throw new Error(`Invalid CSV row on line ${lineNumber}. Expected 4 columns.`);
    }

    const categoryTypeRaw = parts[0]?.trim() ?? "";
    const nameRaw = parts[1] ?? "";
    const correctRaw = parts[2] ?? "";
    const totalRaw = parts[3] ?? "";
    if (
      categoryTypeRaw !== "competency_domain" &&
      categoryTypeRaw !== "clinical_presentation" &&
      categoryTypeRaw !== "discipline" &&
      categoryTypeRaw !== "system" &&
      categoryTypeRaw !== "physician_task" &&
      categoryTypeRaw !== "uworld_subject" &&
      categoryTypeRaw !== "uworld_system"
    ) {
      throw new Error(
        `Invalid categoryType on line ${lineNumber}.`,
      );
    }

    const correct = parseInteger(correctRaw, "correct", lineNumber);
    const total = parseInteger(totalRaw, "total", lineNumber);
    parsedRows.push(buildRow(categoryTypeRaw, nameRaw, correct, total, lineNumber, testType, source));
  }

  return parsedRows;
}

function parseCategoryPerformance(
  lines: string[],
  defaultCategoryType: CategoryType,
  testType: TestType,
  source: QbankSource,
): ParsedRow[] {
  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = splitCsvLine(lines[index]);

    if (parts.length !== 4) {
      throw new Error(`Invalid CSV row on line ${lineNumber}. Expected 4 columns.`);
    }

    const nameRaw = parts[0] ?? "";
    const correctRaw = parts[1] ?? "";
    const incorrectRaw = parts[2] ?? "";
    const totalRaw = parts[3] ?? "";
    const correct = parseInteger(correctRaw, "correct", lineNumber);
    const incorrect = parseInteger(incorrectRaw, "incorrect", lineNumber);
    const total = parseInteger(totalRaw, "total", lineNumber);
    parsedRows.push(buildRow(defaultCategoryType, nameRaw, correct, total, lineNumber, testType, source, incorrect));
  }

  return parsedRows;
}

function parsePercentCorrectTemplate(
  lines: string[],
  defaultCategoryType: CategoryType,
  testType: TestType,
  source: QbankSource,
): ParsedRow[] {
  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = splitCsvLine(lines[index]);

    if (parts.length !== 3) {
      throw new Error(`Invalid CSV row on line ${lineNumber}. Expected 3 columns.`);
    }

    const nameRaw = parts[0] ?? "";
    const percentCorrectRaw = parts[1] ?? "";
    const totalRaw = parts[2] ?? "";
    const percentCorrect = parsePercentCorrect(percentCorrectRaw, lineNumber);
    const total = parseInteger(totalRaw, "total", lineNumber);
    const correct = Math.round(percentCorrect * total);

    parsedRows.push(buildRow(defaultCategoryType, nameRaw, correct, total, lineNumber, testType, source));
  }

  return parsedRows;
}

function parseUworldPerformance(
  lines: string[],
  categoryType: "uworld_subject" | "uworld_system",
  testType: TestType,
  source: QbankSource,
): ParsedRow[] {
  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = splitCsvLine(lines[index]);

    if (parts.length === 4) {
      const nameRaw = parts[0] ?? "";
      const correctRaw = parts[1] ?? "";
      const incorrectRaw = parts[2] ?? "";
      const totalRaw = parts[3] ?? "";
      const correct = parseInteger(correctRaw, "correct", lineNumber);
      const incorrect = parseInteger(incorrectRaw, "incorrect", lineNumber);
      const total = parseInteger(totalRaw, "total", lineNumber);
      parsedRows.push(buildRow(categoryType, nameRaw, correct, total, lineNumber, testType, source, incorrect));
      continue;
    }

    if (parts.length === 3) {
      const nameRaw = parts[0] ?? "";
      const percentCorrectRaw = parts[1] ?? "";
      const totalRaw = parts[2] ?? "";
      const percentCorrect = parsePercentCorrect(percentCorrectRaw, lineNumber);
      const total = parseInteger(totalRaw, "total", lineNumber);
      const correct = Math.round(percentCorrect * total);
      parsedRows.push(buildRow(categoryType, nameRaw, correct, total, lineNumber, testType, source));
      continue;
    }

    throw new Error(`Invalid UWorld CSV row on line ${lineNumber}. Expected 3 or 4 columns.`);
  }

  return parsedRows;
}

export function parseAnyCsv(csvText: string, opts: ParseAnyOptions): ParsedRow[] {
  const lines = parseLines(csvText);
  const headerParts = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const templateId = opts.template ?? detectTemplate(headerParts);

  if (!templateId) {
    throw new Error("Could not auto-detect CSV template. Please select a template manually and try again.");
  }

  const defaultCategoryType = opts.defaultCategoryType ?? "discipline";
  const testType = opts.testType;
  const source = detectSourceFromHeaders(headerParts);

  let parsedRows: ParsedRow[];

  if (templateId === "achilles_simple") {
    const expected = ["categoryType", "name", "correct", "total"];
    const isMatch = expected.every((value, index) => headerParts[index]?.toLowerCase() === value.toLowerCase());
    if (!isMatch || headerParts.length !== expected.length) {
      throw new Error("Invalid CSV header. Expected: categoryType,name,correct,total");
    }
    parsedRows = parseAchillesSimple(lines, testType, source);
  } else if (templateId === "uworld_subject_performance") {
    if (testType !== "usmle_step2") {
      throw new Error("UWorld Step 2 templates are only valid in USMLE Step 2 mode.");
    }
    parsedRows = parseUworldPerformance(lines, "uworld_subject", testType, source);
  } else if (templateId === "uworld_system_performance") {
    if (testType !== "usmle_step2") {
      throw new Error("UWorld Step 2 templates are only valid in USMLE Step 2 mode.");
    }
    parsedRows = parseUworldPerformance(lines, "uworld_system", testType, source);
  } else if (templateId === "category_performance") {
    const expected = ["Category", "Correct", "Incorrect", "Total"];
    const isMatch = expected.every((value, index) => headerParts[index]?.toLowerCase() === value.toLowerCase());
    if (!isMatch || headerParts.length !== expected.length) {
      throw new Error("Invalid CSV header. Expected: Category,Correct,Incorrect,Total");
    }
    parsedRows = parseCategoryPerformance(lines, defaultCategoryType, testType, source);
  } else {
    const expected = ["Category", "PercentCorrect", "Total"];
    const isMatch = expected.every((value, index) => headerParts[index]?.toLowerCase() === value.toLowerCase());
    if (!isMatch || headerParts.length !== expected.length) {
      throw new Error("Invalid CSV header. Expected: Category,PercentCorrect,Total");
    }
    parsedRows = parsePercentCorrectTemplate(lines, defaultCategoryType, testType, source);
  }

  if (parsedRows.length === 0) {
    throw new Error("CSV has no data rows.");
  }

  return parsedRows;
}
