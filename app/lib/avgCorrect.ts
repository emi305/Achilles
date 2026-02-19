export function parseIntSafe(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.trunc(value));
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(/,/g, "");
    if (!normalized || normalized === "—" || normalized === "-") {
      return null;
    }
    const parsed = Number(normalized);
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.trunc(parsed));
    }
  }
  return null;
}

export function computeAccuracy(correctCount: unknown, incorrectCount: unknown): number | null {
  const correct = parseIntSafe(correctCount);
  const incorrect = parseIntSafe(incorrectCount);
  if (correct == null || incorrect == null) {
    return null;
  }
  const attempted = correct + incorrect;
  if (attempted <= 0) {
    return null;
  }
  return correct / attempted;
}

export function computeAvgPercentCorrect(
  correctCount: unknown,
  incorrectCount: unknown,
): number | null {
  const accuracy = computeAccuracy(correctCount, incorrectCount);
  if (accuracy == null) {
    return null;
  }
  return accuracy * 100;
}
