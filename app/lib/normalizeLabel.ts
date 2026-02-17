import { sanitizeCategoryLabel } from "./textSanitize";

export function normalizeLabel(value: string): string {
  return sanitizeCategoryLabel(value)
    .replace(/[(),/.]/g, " ")
    .replace(/[-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

