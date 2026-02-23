import type { CategoryType, TestType } from "./types";

export type RehabCategorySnapshotInput = {
  categoryName: string;
  categoryType: CategoryType;
  weight: number | null;
  roi: number | null;
  hasRoi: boolean;
  proi: number | null;
  hasProi: boolean;
  avgPercentCorrect: number | null;
  attemptedCount: number | null;
};

export type RehabSnapshotSaveRequest = {
  clientSnapshotKey: string;
  examMode: TestType;
  snapshotAt: string;
  label?: string | null;
  hasQbankData: boolean;
  hasScoreReportData: boolean;
  overallRoi: number | null;
  overallProi: number | null;
  overallAvgPercentCorrect: number | null;
  overallAttemptedCount: number | null;
  categories: RehabCategorySnapshotInput[];
};

export type RehabRunRecord = {
  id: string;
  examMode: TestType;
  snapshotAt: string;
  label: string | null;
  hasQbankData: boolean;
  hasScoreReportData: boolean;
  overallRoi: number | null;
  overallProi: number | null;
  overallAvgPercentCorrect: number | null;
  overallAttemptedCount: number | null;
};

export type RehabCategoryRecord = {
  runId: string;
  examMode: TestType;
  categoryName: string;
  categoryType: CategoryType;
  weight: number | null;
  roi: number | null;
  hasRoi: boolean;
  proi: number | null;
  hasProi: boolean;
  avgPercentCorrect: number | null;
  attemptedCount: number | null;
};

export type RehabSnapshotsResponse = {
  runs: RehabRunRecord[];
  categories: RehabCategoryRecord[];
  setupRequired?: boolean;
  message?: string;
};

export type RehabMetricKey = "roi" | "proi" | "avg_percent_correct";

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function rehabMetricDisplayName(metric: RehabMetricKey): string {
  if (metric === "roi") return "ROI Trend";
  if (metric === "proi") return "PROI Trend";
  return "Avg % Correct Trend";
}

export function toRehabProgressValue(metric: RehabMetricKey, rawValue: number): number {
  if (metric === "avg_percent_correct") {
    return rawValue;
  }
  // ROI/PROI are "badness" metrics. Invert so higher chart values mean improvement.
  return -rawValue;
}

export function fromRehabProgressValue(metric: RehabMetricKey, progressValue: number): number {
  if (metric === "avg_percent_correct") {
    return progressValue;
  }
  return -progressValue;
}
