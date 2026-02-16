import type { QbankSource } from "./mappingCatalog";

function normalize(values: string[]): string[] {
  return values.map((v) => v.toLowerCase().trim());
}

export function detectSourceFromHeaders(headers: string[]): QbankSource {
  const normalized = normalize(headers);
  const joined = normalized.join(" ");

  if (
    joined.includes("truelearn") ||
    (normalized.includes("category") && normalized.includes("correct") && normalized.includes("incorrect"))
  ) {
    return "truelearn";
  }

  if (joined.includes("uworld") || joined.includes("subject") || joined.includes("percent correct")) {
    return "uworld";
  }

  if (joined.includes("amboss") || joined.includes("question id") || joined.includes("session")) {
    return "amboss";
  }

  return "unknown";
}
