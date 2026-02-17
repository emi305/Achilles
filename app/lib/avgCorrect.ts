function toSafeInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    if (!normalized) {
      return 0;
    }
    const parsed = Number.parseInt(normalized, 10);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }
  return 0;
}

export function computeAvgPercentCorrect(
  correctCount: unknown,
  incorrectCount: unknown,
): number | null {
  const correct = toSafeInt(correctCount);
  const incorrect = toSafeInt(incorrectCount);
  const attempted = correct + incorrect;
  if (attempted <= 0) {
    return null;
  }
  return (correct / attempted) * 100;
}

