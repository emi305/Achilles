import type { ExtractedRow } from "./types";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function computeOverallConfidence(rows: ExtractedRow[]): number {
  if (rows.length === 0) {
    return 0;
  }

  let weightedConfidence = 0;
  let totalWeight = 0;

  for (const row of rows) {
    const rowWeight = typeof row.total === "number" && row.total > 0 ? row.total : 1;
    weightedConfidence += clamp01(row.confidence) * rowWeight;
    totalWeight += rowWeight;
  }

  if (totalWeight === 0) {
    return 0;
  }

  return clamp01(weightedConfidence / totalWeight);
}
