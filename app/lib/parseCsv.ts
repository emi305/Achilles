import { getWeightForCategory } from "./blueprint";
import { detectSourceFromHeaders } from "./detectSource";
import { canonicalizeCategoryName } from "./nameMatching";
import type { CategoryType, ParsedRow, TestType } from "./types";

const EXPECTED_HEADER = ["categoryType", "name", "correct", "total"];

function isCategoryType(value: string): value is CategoryType {
  return (
    value === "competency_domain" ||
    value === "clinical_presentation" ||
    value === "discipline" ||
    value === "system" ||
    value === "physician_task" ||
    value === "uworld_subject" ||
    value === "uworld_system"
  );
}

function parseInteger(value: string, label: string, lineNumber: number): number {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid ${label} on line ${lineNumber}. Expected a non-negative integer.`);
  }

  return Number(trimmed);
}

export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes) {
        const nextChar = line[index + 1];
        if (nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        inQuotes = true;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  fields.push(current);
  return fields;
}

export function parseCsv(csvText: string, testType: TestType): ParsedRow[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    throw new Error("CSV input is empty.");
  }

  const headerParts = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const isExpectedHeader =
    headerParts.length === EXPECTED_HEADER.length &&
    EXPECTED_HEADER.every((headerCell, index) => headerParts[index] === headerCell);

  if (!isExpectedHeader) {
    throw new Error("Invalid CSV header. Expected: categoryType, name, correct, total");
  }

  const parsedRows: ParsedRow[] = [];
  const source = detectSourceFromHeaders(headerParts);

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

    if (!isCategoryType(categoryTypeRaw)) {
      throw new Error(
        `Invalid categoryType on line ${lineNumber}. Use competency_domain, clinical_presentation, or discipline.`,
      );
    }

    if (!nameRaw.trim()) {
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
    const matched = canonicalizeCategoryName(categoryTypeRaw, nameRaw, testType, source);
    const canonicalName = matched.canonicalName;
    const weight = canonicalName ? getWeightForCategory(categoryTypeRaw, canonicalName, testType) : null;
    const roi = (1 - accuracy) * (weight ?? 0);

    parsedRows.push({
      testType,
      source,
      categoryType: categoryTypeRaw,
      name: canonicalName ?? nameRaw,
      canonicalName,
      originalName: nameRaw,
      matchType: matched.matchType,
      matchScore: matched.matchScore,
      unmapped: matched.matchType === "none" || weight == null,
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

// Sanity examples:
// splitCsvLine('competency_domain,"Osteopathic Principles, Practice, and Manipulative Treatment",6,20')
// => ["competency_domain", "Osteopathic Principles, Practice, and Manipulative Treatment", "6", "20"]
// splitCsvLine('discipline,"Psychiatry ""consult"" cases",5,10')
// => ["discipline", "Psychiatry \"consult\" cases", "5", "10"]
// splitCsvLine('discipline,Internal Medicine,50,80')
// => ["discipline", "Internal Medicine", "50", "80"]
