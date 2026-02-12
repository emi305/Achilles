import { getWeightForCategory } from "./comlexWeights";
import type { CategoryType, ParsedRow } from "./types";

const EXPECTED_HEADER = ["categoryType", "name", "correct", "total"];

function isCategoryType(value: string): value is CategoryType {
  return value === "competency_domain" || value === "clinical_presentation" || value === "discipline";
}

function parseInteger(value: string, label: string, lineNumber: number): number {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid ${label} on line ${lineNumber}. Expected a non-negative integer.`);
  }

  return Number(trimmed);
}

export function parseCsv(csvText: string): ParsedRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV input is empty.");
  }

  const headerParts = lines[0].split(",").map((cell) => cell.trim());
  const isExpectedHeader =
    headerParts.length === EXPECTED_HEADER.length &&
    EXPECTED_HEADER.every((headerCell, index) => headerParts[index] === headerCell);

  if (!isExpectedHeader) {
    throw new Error("Invalid CSV header. Expected: categoryType, name, correct, total");
  }

  const parsedRows: ParsedRow[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const parts = lines[index].split(",").map((cell) => cell.trim());

    if (parts.length !== 4) {
      throw new Error(`Invalid CSV row on line ${lineNumber}. Expected 4 columns.`);
    }

    const [categoryTypeRaw, nameRaw, correctRaw, totalRaw] = parts;

    if (!isCategoryType(categoryTypeRaw)) {
      throw new Error(
        `Invalid categoryType on line ${lineNumber}. Use competency_domain, clinical_presentation, or discipline.`,
      );
    }

    if (!nameRaw) {
      throw new Error(`Missing name on line ${lineNumber}.`);
    }

    const correct = parseInteger(correctRaw, "correct", lineNumber);
    const total = parseInteger(totalRaw, "total", lineNumber);

    if (total === 0) {
      throw new Error(`Invalid total on line ${lineNumber}. Total must be greater than 0.`);
    }

    if (correct > total) {
      throw new Error(`Invalid row on line ${lineNumber}. Correct cannot be greater than total.`);
    }

    const accuracy = correct / total;
    const weight = getWeightForCategory(categoryTypeRaw, nameRaw);
    const roi = (1 - accuracy) * weight;

    parsedRows.push({
      categoryType: categoryTypeRaw,
      name: nameRaw,
      correct,
      total,
      accuracy,
      weight,
      roi,
    });
  }

  if (parsedRows.length === 0) {
    throw new Error("CSV has no data rows.");
  }

  return parsedRows;
}