import type { ParsedRow } from "./types";

export type RankingMode = "roi" | "weakness";

export function getRoiScore(row: Pick<ParsedRow, "roi">): number {
  return typeof row.roi === "number" && Number.isFinite(row.roi) ? row.roi : 0;
}

export function getProiScore(row: Pick<ParsedRow, "proi">): number {
  return typeof row.proi === "number" && Number.isFinite(row.proi) ? row.proi : 0;
}

export function getWeaknessScore(row: Pick<ParsedRow, "accuracy" | "proxyWeakness">): number {
  if (typeof row.accuracy === "number" && Number.isFinite(row.accuracy)) {
    return Math.max(0, Math.min(1, 1 - row.accuracy));
  }

  if (typeof row.proxyWeakness === "number" && Number.isFinite(row.proxyWeakness)) {
    return Math.max(0, Math.min(1, row.proxyWeakness));
  }

  return 0;
}

export function sortRowsByMode<T extends Pick<ParsedRow, "roi" | "proi" | "accuracy" | "proxyWeakness" | "name">>(
  rows: T[],
  mode: RankingMode,
): T[] {
  return [...rows].sort((a, b) => {
    const aRoi = getRoiScore(a);
    const bRoi = getRoiScore(b);
    const aProi = getProiScore(a);
    const bProi = getProiScore(b);
    const aWeakness = getWeaknessScore(a);
    const bWeakness = getWeaknessScore(b);

    if (mode === "weakness") {
      if (bWeakness !== aWeakness) {
        return bWeakness - aWeakness;
      }
      if (bRoi !== aRoi) {
        return bRoi - aRoi;
      }
      if (bProi !== aProi) {
        return bProi - aProi;
      }
      return a.name.localeCompare(b.name);
    }

    if (bRoi !== aRoi) {
      return bRoi - aRoi;
    }
    if (bProi !== aProi) {
      return bProi - aProi;
    }
    return a.name.localeCompare(b.name);
  });
}
