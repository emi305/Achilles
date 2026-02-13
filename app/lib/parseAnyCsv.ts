import { getWeightForCategory } from "./comlexWeights";
import { detectTemplate } from "./detectTemplate";
import { splitCsvLine } from "./parseCsv";
import type { TemplateId } from "./templates";
import type { CategoryType, ParsedRow } from "./types";

type ParseAnyOptions = {
  template?: TemplateId;
  defaultCategoryType?: CategoryType;
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

function buildRow(categoryType: CategoryType, name: string, correct: number, total: number, lineNumber: number): ParsedRow {
  if (!name.trim()) {
    throw new Error(`Missing name on line ${lineNumber}.`);
  }

  if (total === 0) {
    throw new Error(`Invalid total on line ${lineNumber}. Total must be greater than 0.`);
  }

  if (correct > total) {
    throw new Error(`Invalid row on line ${lineNumber}. Correct cannot be greater than total.`);
  }

  const accuracy = correct / total;
  const weight = getWeightForCategory(categoryType, name);
  const roi = (1 - accuracy) * weight;

  return {
    categoryType,
    name,
    correct,
    total,
    accuracy,
    weight,
    roi,
  };
}

function parseAchillesSimple(lines: string[]): ParsedRow[] {
  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = splitCsvLine(lines[index]).map((cell) => cell.trim());

    if (parts.length !== 4) {
      throw new Error(`Invalid CSV row on line ${lineNumber}. Expected 4 columns.`);
    }

    const [categoryTypeRaw, nameRaw, correctRaw, totalRaw] = parts;
    if (
      categoryTypeRaw !== "competency_domain" &&
      categoryTypeRaw !== "clinical_presentation" &&
      categoryTypeRaw !== "discipline"
    ) {
      throw new Error(
        `Invalid categoryType on line ${lineNumber}. Use competency_domain, clinical_presentation, or discipline.`,
      );
    }

    const correct = parseInteger(correctRaw, "correct", lineNumber);
    const total = parseInteger(totalRaw, "total", lineNumber);
    parsedRows.push(buildRow(categoryTypeRaw, nameRaw, correct, total, lineNumber));
  }

  return parsedRows;
}

function parseCategoryPerformance(lines: string[], defaultCategoryType: CategoryType): ParsedRow[] {
  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = splitCsvLine(lines[index]).map((cell) => cell.trim());

    if (parts.length !== 4) {
      throw new Error(`Invalid CSV row on line ${lineNumber}. Expected 4 columns.`);
    }

    const [nameRaw, correctRaw, , totalRaw] = parts;
    const correct = parseInteger(correctRaw, "correct", lineNumber);
    const total = parseInteger(totalRaw, "total", lineNumber);
    parsedRows.push(buildRow(defaultCategoryType, nameRaw, correct, total, lineNumber));
  }

  return parsedRows;
}

function parsePercentCorrectTemplate(lines: string[], defaultCategoryType: CategoryType): ParsedRow[] {
  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = splitCsvLine(lines[index]).map((cell) => cell.trim());

    if (parts.length !== 3) {
      throw new Error(`Invalid CSV row on line ${lineNumber}. Expected 3 columns.`);
    }

    const [nameRaw, percentCorrectRaw, totalRaw] = parts;
    const percentCorrect = parsePercentCorrect(percentCorrectRaw, lineNumber);
    const total = parseInteger(totalRaw, "total", lineNumber);
    const correct = Math.round(percentCorrect * total);

    parsedRows.push(buildRow(defaultCategoryType, nameRaw, correct, total, lineNumber));
  }

  return parsedRows;
}

export function parseAnyCsv(csvText: string, opts: ParseAnyOptions = {}): ParsedRow[] {
  const lines = parseLines(csvText);
  const headerParts = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const templateId = opts.template ?? detectTemplate(headerParts);

  if (!templateId) {
    throw new Error("Could not auto-detect CSV template. Please select a template manually and try again.");
  }

  const defaultCategoryType = opts.defaultCategoryType ?? "discipline";

  let parsedRows: ParsedRow[];

  if (templateId === "achilles_simple") {
    const expected = ["categoryType", "name", "correct", "total"];
    const isMatch = expected.every((value, index) => headerParts[index]?.toLowerCase() === value.toLowerCase());
    if (!isMatch || headerParts.length !== expected.length) {
      throw new Error("Invalid CSV header. Expected: categoryType,name,correct,total");
    }
    parsedRows = parseAchillesSimple(lines);
  } else if (templateId === "category_performance") {
    const expected = ["Category", "Correct", "Incorrect", "Total"];
    const isMatch = expected.every((value, index) => headerParts[index]?.toLowerCase() === value.toLowerCase());
    if (!isMatch || headerParts.length !== expected.length) {
      throw new Error("Invalid CSV header. Expected: Category,Correct,Incorrect,Total");
    }
    parsedRows = parseCategoryPerformance(lines, defaultCategoryType);
  } else {
    const expected = ["Category", "PercentCorrect", "Total"];
    const isMatch = expected.every((value, index) => headerParts[index]?.toLowerCase() === value.toLowerCase());
    if (!isMatch || headerParts.length !== expected.length) {
      throw new Error("Invalid CSV header. Expected: Category,PercentCorrect,Total");
    }
    parsedRows = parsePercentCorrectTemplate(lines, defaultCategoryType);
  }

  if (parsedRows.length === 0) {
    throw new Error("CSV has no data rows.");
  }

  return parsedRows;
}