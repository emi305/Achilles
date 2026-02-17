import type { InputSource, TestType } from "./types";
import { USMLE2_UWORLD_SYSTEMS, USMLE2_UWORLD_SUBJECTS } from "./usmleStep2UworldCatalog";

function normalizeForScan(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function detectInputSourceFromText(rawText: string, testType: TestType): InputSource {
  const text = rawText.toLowerCase();
  if (!text.trim()) {
    return "unknown";
  }

  if (testType === "usmle_step2") {
    const hasUworldHeaderSignals =
      /(usage|correct q|incorrect q|omitted q|p-rank)/i.test(rawText) &&
      /(subject|subjects|system|systems)/i.test(rawText);
    if (hasUworldHeaderSignals) {
      return "uworld_qbank";
    }

    const normalizedText = normalizeForScan(rawText);
    const subjectHits = USMLE2_UWORLD_SUBJECTS.filter((label) =>
      normalizedText.includes(normalizeForScan(label)),
    ).length;
    const systemHits = USMLE2_UWORLD_SYSTEMS.filter((label) =>
      normalizedText.includes(normalizeForScan(label)),
    ).length;
    if (subjectHits >= 3 || systemHits >= 4) {
      return "uworld_qbank";
    }
  }

  return "unknown";
}
