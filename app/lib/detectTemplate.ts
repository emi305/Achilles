import type { TemplateId } from "./templates";

function normalizeHeader(value: string) {
  return value.trim().toLowerCase();
}

function matchesHeader(headers: string[], expected: string[]) {
  if (headers.length !== expected.length) {
    return false;
  }

  return expected.every((value, index) => normalizeHeader(headers[index]) === normalizeHeader(value));
}

export function detectTemplate(headers: string[]): TemplateId | null {
  if (matchesHeader(headers, ["Subject", "Correct", "Incorrect", "Total"])) {
    return "uworld_subject_performance";
  }

  if (matchesHeader(headers, ["System", "Correct", "Incorrect", "Total"])) {
    return "uworld_system_performance";
  }

  if (matchesHeader(headers, ["Subject", "PercentCorrect", "Total"])) {
    return "uworld_subject_performance";
  }

  if (matchesHeader(headers, ["System", "PercentCorrect", "Total"])) {
    return "uworld_system_performance";
  }

  if (matchesHeader(headers, ["categoryType", "name", "correct", "total"])) {
    return "achilles_simple";
  }

  if (matchesHeader(headers, ["Category", "Correct", "Incorrect", "Total"])) {
    return "category_performance";
  }

  if (matchesHeader(headers, ["Category", "PercentCorrect", "Total"])) {
    return "percent_correct";
  }

  return null;
}
