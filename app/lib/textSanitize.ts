export function sanitizeCategoryLabel(raw: unknown): string {
  if (raw === null || raw === undefined) {
    return "";
  }

  return String(raw)
    .normalize("NFKC")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, "")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/[^a-z0-9\s,/:()'-]/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
