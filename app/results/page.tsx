"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../components/Alert";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { computeAccuracy, computeAvgPercentCorrect } from "../lib/avgCorrect";
import { CATEGORY_LABEL_BY_TYPE, getCategoryOrderForTest } from "../lib/blueprint";
import {
  clearUploadSession,
  getClientParsedRows,
  getUploadSession,
  getServerParsedRows,
  subscribeUploadSession,
} from "../lib/session";
import { DEFAULT_TEST_TYPE, getTestLabel } from "../lib/testSelection";
import {
  STEP2_SUBJECT_CANONICAL,
  STEP2_SUBJECT_WEIGHTS,
  STEP2_SYSTEM_CANONICAL,
  STEP2_SYSTEM_WEIGHTS,
  assertStep2CanonicalWeights,
  canonicalizeSubjectLabel,
  canonicalizeSystemLabel,
  type Step2SubjectCanonical,
  type Step2SystemCanonical,
} from "../lib/usmleStep2Canonical";
import type { CategoryType, ParsedRow, TestType, ZeusContext, ZeusContextRow } from "../lib/types";
import { getProiScore, type RankingMode } from "../lib/priority";

type DisplayRow = {
  categoryType: CategoryType;
  name: string;
  blueprintWeight: number | null;
  roi: number | null;
  proi: number;
  hasRoi: boolean;
  hasProi: boolean;
  avgCorrect?: number;
  avgPercentCorrect?: number | null;
  qbankCorrectSum: number;
  qbankIncorrectSum: number;
  attemptedCount: number;
  usageWeight: number | null;
  weaknessForSort: number;
  focusScore: number;
};

type TruthPanelRow = {
  displayName: string;
  sourceType: string;
  blueprintWeightUsed: number | null;
  usageWeightUsed: number | null;
  correctCount: number;
  incorrectCount: number;
  attempted: number;
  accuracyComputed: number | null;
  avgPercentDisplayed: number | null;
  avgPercentComputed: number | null;
  drift: number | null;
};

type TableSection = {
  key: "general" | CategoryType;
  title: string;
  rows: DisplayRow[];
};

type AccumulatorRow = {
  categoryType: CategoryType;
  name: string;
  blueprintWeight: number | null;
  proi: number;
  hasRoi: boolean;
  hasProi: boolean;
  qbankCorrectSum: number;
  qbankIncorrectSum: number;
};

type AggregationBucket = {
  key: string;
  categoryType: CategoryType;
  name: string;
  blueprintWeight: number | null;
  reason: "mapped" | "unmapped_attempted";
};

type UnmappedRowGroup = {
  originalName: string;
  categoryType: CategoryType;
  source: string;
  count: number;
  examples: string[];
};

type Step2MappingAuditEntry = {
  rawLabel: string;
  parsedCategoryType: CategoryType;
  mappedSubject: Step2SubjectCanonical;
  mappedSystem: Step2SystemCanonical;
  subjectReason: string;
  systemReason: string;
  subjectUnmapped: boolean;
  systemUnmapped: boolean;
  attempted: number;
  correct: number | null;
  incorrectCount: number | null;
};

type Big3Metric = "roi" | "proi";
const WHAT_TO_STUDY_K = 7;
const WHAT_TO_STUDY_SYSTEMS_N = 10;
const COMLEX_TOP_N = 5;

const modeLabels: Record<RankingMode, string> = {
  roi: "Rank by ROI",
  avg: "Rank by Avg % Correct",
};

const PROI_PLACEHOLDER = "Not available (upload score report)";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPercent(value: number) {
  return `${round2(value * 100).toFixed(1)}%`;
}

function formatPercentFrom100(value: number) {
  return `${round2(value).toFixed(1)}%`;
}

function formatScore(value: number) {
  return value.toFixed(3);
}

function formatMissingMetric(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? formatScore(value) : "-";
}

function hasUsableQbankData(row: DisplayRow): row is DisplayRow & { roi: number; avgPercentCorrect: number } {
  return row.attemptedCount > 0 && typeof row.avgPercentCorrect === "number" && typeof row.roi === "number";
}

function isUworldTaxonomyRow(row: ParsedRow | DisplayRow) {
  return row.categoryType === "uworld_subject" || row.categoryType === "uworld_system";
}

function buildBig3Data(rows: DisplayRow[], metric: Big3Metric) {
  const subjectType: CategoryType = "uworld_subject";
  const systemType: CategoryType = "uworld_system";
  const metricRows = rows.filter((row) =>
    metric === "roi"
      ? row.categoryType === subjectType || row.categoryType === systemType
      : (row.categoryType === subjectType || row.categoryType === systemType) && row.hasProi,
  );

  const medicineRow =
    metricRows.find((row) => row.categoryType === subjectType && row.name === "Medicine") ??
    metricRows.find((row) => row.categoryType === subjectType);
  const topSystems = metricRows
    .filter((row) => row.categoryType === systemType)
    .sort((a, b) => {
      const aMetric = metric === "roi" ? (a.roi ?? Number.NEGATIVE_INFINITY) : a.proi;
      const bMetric = metric === "roi" ? (b.roi ?? Number.NEGATIVE_INFINITY) : b.proi;
      return bMetric - aMetric;
    })
    .slice(0, 3);
  const biostatsRow = metricRows.find(
    (row) => row.categoryType === systemType && row.name === "Biostatistics/Epi/Population Health/Med Lit",
  );
  const socialRow = metricRows.find(
    (row) => row.categoryType === systemType && row.name === "Social Sciences (Ethics/Legal/Professionalism/Patient Safety)",
  );

  return {
    hasData: metricRows.length > 0,
    medicineRow,
    topSystems,
    biostatsRow,
    socialRow,
  };
}

function withUsmleCanonicalCoverage(rows: DisplayRow[], selectedTest: TestType): DisplayRow[] {
  if (selectedTest !== "usmle_step2") {
    return rows;
  }

  const byKey = new Map<string, DisplayRow>();
  for (const row of rows) {
    byKey.set(`${row.categoryType}::${row.name}`, row);
  }
  const filled = [...rows];

  for (const name of STEP2_SUBJECT_CANONICAL) {
    const weight = STEP2_SUBJECT_WEIGHTS[name];
    const key = `uworld_subject::${name}`;
    if (byKey.has(key)) {
      continue;
    }
    filled.push({
      categoryType: "uworld_subject",
      name,
      blueprintWeight: weight,
      roi: 0,
      proi: 0,
      hasRoi: false,
      hasProi: false,
      avgCorrect: undefined,
      avgPercentCorrect: null,
      qbankCorrectSum: 0,
      qbankIncorrectSum: 0,
      attemptedCount: 0,
      usageWeight: null,
      weaknessForSort: 0,
      focusScore: 0,
    });
  }

  for (const name of STEP2_SYSTEM_CANONICAL) {
    const weight = STEP2_SYSTEM_WEIGHTS[name];
    const key = `uworld_system::${name}`;
    if (byKey.has(key)) {
      continue;
    }
    filled.push({
      categoryType: "uworld_system",
      name,
      blueprintWeight: weight,
      roi: 0,
      proi: 0,
      hasRoi: false,
      hasProi: false,
      avgCorrect: undefined,
      avgPercentCorrect: null,
      qbankCorrectSum: 0,
      qbankIncorrectSum: 0,
      attemptedCount: 0,
      usageWeight: null,
      weaknessForSort: 0,
      focusScore: 0,
    });
  }

  return filled;
}

function sortDisplayRows(rows: DisplayRow[], mode: RankingMode): DisplayRow[] {
  const sorted = [...rows].sort((a, b) => {
    if (mode === "avg") {
      const aAvg = typeof a.avgCorrect === "number" ? a.avgCorrect : Number.POSITIVE_INFINITY;
      const bAvg = typeof b.avgCorrect === "number" ? b.avgCorrect : Number.POSITIVE_INFINITY;
      if (aAvg !== bAvg) {
        return aAvg - bAvg;
      }
      const aWeight = a.blueprintWeight ?? Number.NEGATIVE_INFINITY;
      const bWeight = b.blueprintWeight ?? Number.NEGATIVE_INFINITY;
      if (bWeight !== aWeight) {
        return bWeight - aWeight;
      }
      return a.name.localeCompare(b.name);
    }

    const aRoi = a.roi ?? Number.NEGATIVE_INFINITY;
    const bRoi = b.roi ?? Number.NEGATIVE_INFINITY;
    if (bRoi !== aRoi) {
      return bRoi - aRoi;
    }
    const aWeight = a.blueprintWeight ?? Number.NEGATIVE_INFINITY;
    const bWeight = b.blueprintWeight ?? Number.NEGATIVE_INFINITY;
    if (bWeight !== aWeight) {
      return bWeight - aWeight;
    }
    return a.name.localeCompare(b.name);
  });
  return sorted;
}

function sortByFocusScore(rows: DisplayRow[]): DisplayRow[] {
  return [...rows].sort((a, b) => {
    if (b.focusScore !== a.focusScore) {
      return b.focusScore - a.focusScore;
    }
    if (b.proi !== a.proi) {
      return b.proi - a.proi;
    }
    const aRoi = a.roi ?? Number.NEGATIVE_INFINITY;
    const bRoi = b.roi ?? Number.NEGATIVE_INFINITY;
    if (bRoi !== aRoi) {
      return bRoi - aRoi;
    }
    if (b.weaknessForSort !== a.weaknessForSort) {
      return b.weaknessForSort - a.weaknessForSort;
    }
    return a.name.localeCompare(b.name);
  });
}

function resolveAggregationBucket(row: ParsedRow, hasAttemptedCounts: boolean): AggregationBucket | null {
  const hasMappedBucket = !row.unmapped;
  if (hasMappedBucket) {
    const name = row.name;
    return {
      key: `${row.categoryType}::${name}`,
      categoryType: row.categoryType,
      name,
      blueprintWeight: row.weight ?? null,
      reason: "mapped",
    };
  }

  if (hasAttemptedCounts) {
    const name = `Unmapped: ${row.name}`;
    return {
      key: `${row.categoryType}::${name}`,
      categoryType: row.categoryType,
      name,
      blueprintWeight: row.weight ?? null,
      reason: "unmapped_attempted",
    };
  }

  return null;
}

function getStep2BucketsForRow(row: ParsedRow, hasAttemptedCounts: boolean): AggregationBucket[] {
  const rawLabel = row.originalName ?? row.name;
  const systemResult = canonicalizeSystemLabel(rawLabel);
  const subjectResult = canonicalizeSubjectLabel(rawLabel, { systemCanonical: systemResult.canonical });
  const subjectWeight = STEP2_SUBJECT_WEIGHTS[subjectResult.canonical];
  const systemWeight = STEP2_SYSTEM_WEIGHTS[systemResult.canonical];
  const buckets: AggregationBucket[] = [
    {
      key: `uworld_subject::${subjectResult.canonical}`,
      categoryType: "uworld_subject",
      name: subjectResult.canonical,
      blueprintWeight: subjectWeight ?? null,
      reason: subjectResult.unmapped ? "unmapped_attempted" : "mapped",
    },
    {
      key: `uworld_system::${systemResult.canonical}`,
      categoryType: "uworld_system",
      name: systemResult.canonical,
      blueprintWeight: systemWeight ?? null,
      reason: systemResult.unmapped ? "unmapped_attempted" : "mapped",
    },
  ];
  if (!hasAttemptedCounts) {
    return buckets;
  }
  return buckets;
}

function finalizeAccumulator(value: AccumulatorRow, usageWeight: number | null): DisplayRow {
  const attemptedCount = value.qbankCorrectSum + value.qbankIncorrectSum;
  const avgPercentCorrect = computeAvgPercentCorrect(value.qbankCorrectSum, value.qbankIncorrectSum);
  const computedAccuracy = computeAccuracy(value.qbankCorrectSum, value.qbankIncorrectSum);
  const avgCorrect = typeof computedAccuracy === "number" ? clamp01(computedAccuracy) : undefined;

  if (process.env.NODE_ENV !== "production") {
    if (!Number.isInteger(attemptedCount) || attemptedCount < 0) {
      throw new Error(`[avg-correct] invalid attempted count for "${value.name}": ${attemptedCount}`);
    }
    if (computedAccuracy != null && (computedAccuracy < 0 || computedAccuracy > 1)) {
      throw new Error(`[avg-correct] invalid accuracy for "${value.name}": ${computedAccuracy}`);
    }
    if (avgPercentCorrect != null && (avgPercentCorrect < 0 || avgPercentCorrect > 100)) {
      throw new Error(`[avg-correct] invalid percent for "${value.name}": ${avgPercentCorrect}`);
    }
    if (attemptedCount > 0 && avgPercentCorrect != null) {
      const expected = (value.qbankCorrectSum / attemptedCount) * 100;
      if (Math.abs(expected - avgPercentCorrect) > 0.05) {
        throw new Error(
          `[avg-correct] denominator drift for "${value.name}": expected=${expected.toFixed(3)} actual=${avgPercentCorrect.toFixed(3)}`,
        );
      }
    }
  }

  const weaknessForSort = typeof avgCorrect === "number" ? clamp01(1 - avgCorrect) : 0;
  const weaknessWeighted = weaknessForSort * (value.blueprintWeight ?? 0);
  const roiWeight = value.blueprintWeight ?? usageWeight ?? 0;
  const roi = typeof computedAccuracy === "number" ? (1 - computedAccuracy) * roiWeight : null;
  const focusScore = (roi ?? 0) + value.proi + weaknessWeighted;

  return {
    categoryType: value.categoryType,
    name: value.name,
    blueprintWeight: value.blueprintWeight,
    roi,
    proi: value.proi,
    hasRoi: value.hasRoi,
    hasProi: value.hasProi,
    avgCorrect,
    avgPercentCorrect,
    qbankCorrectSum: value.qbankCorrectSum,
    qbankIncorrectSum: value.qbankIncorrectSum,
    attemptedCount,
    usageWeight,
    weaknessForSort,
    focusScore,
  };
}

function aggregateRows(rows: ParsedRow[], selectedTest: TestType): DisplayRow[] {
  const byKey = new Map<string, AccumulatorRow>();
  const warnedUsageMismatch = new Set<string>();

  for (const row of rows) {
    const hasCountAccuracy =
      typeof row.correct === "number" && typeof row.incorrectCount === "number" && row.incorrectCount >= 0;
    const isStep2UworldRow =
      selectedTest === "usmle_step2" && (row.inputSource === "uworld_qbank" || isUworldTaxonomyRow(row));
    const buckets = isStep2UworldRow ? getStep2BucketsForRow(row, hasCountAccuracy) : [resolveAggregationBucket(row, hasCountAccuracy)].filter(Boolean) as AggregationBucket[];
    if (buckets.length === 0) {
      continue;
    }

    const hasProi = typeof row.proxyWeakness === "number" || typeof row.proi === "number";
    const rowProi = hasProi ? getProiScore(row) : 0;
    const hasQbankAccuracy = hasCountAccuracy;

    for (const bucket of buckets) {
      const existing = byKey.get(bucket.key);
      if (!existing) {
        const created: AccumulatorRow = {
          categoryType: bucket.categoryType,
          name: bucket.name,
          blueprintWeight: bucket.blueprintWeight,
          proi: rowProi,
          hasRoi: hasQbankAccuracy,
          hasProi,
          qbankCorrectSum: 0,
          qbankIncorrectSum: 0,
        };

        if (typeof row.correct === "number" && typeof row.incorrectCount === "number" && row.incorrectCount >= 0) {
          created.qbankCorrectSum += row.correct;
          created.qbankIncorrectSum += row.incorrectCount;
        } else if (
          process.env.NODE_ENV !== "production" &&
          (typeof row.correct === "number" || typeof row.accuracy === "number")
        ) {
          console.warn(`[avg-correct] missing incorrectCount for "${row.name}" in aggregation path.`);
        }

        if (
          process.env.NODE_ENV !== "production" &&
          typeof row.usageUsed === "number" &&
          typeof row.correct === "number" &&
          typeof row.incorrectCount === "number"
        ) {
          const omitted = typeof row.omittedCount === "number" ? row.omittedCount : 0;
          const expectedUsage = row.correct + row.incorrectCount + omitted;
          if (row.usageUsed !== expectedUsage) {
            const warnKey = bucket.key;
            if (!warnedUsageMismatch.has(warnKey)) {
              warnedUsageMismatch.add(warnKey);
              console.warn(
                `[avg-correct] usage mismatch for "${row.name}": usageUsed=${row.usageUsed}, correct+incorrect+omitted=${expectedUsage}`,
              );
            }
          }
        }

        byKey.set(bucket.key, created);
        continue;
      }

      existing.blueprintWeight =
        typeof existing.blueprintWeight === "number" && typeof bucket.blueprintWeight === "number"
          ? Math.max(existing.blueprintWeight, bucket.blueprintWeight)
          : existing.blueprintWeight ?? bucket.blueprintWeight ?? null;
      existing.proi += rowProi;
      existing.hasRoi = existing.hasRoi || hasQbankAccuracy;
      existing.hasProi = existing.hasProi || hasProi;

      if (typeof row.correct === "number" && typeof row.incorrectCount === "number" && row.incorrectCount >= 0) {
        existing.qbankCorrectSum += row.correct;
        existing.qbankIncorrectSum += row.incorrectCount;
      } else if (
        process.env.NODE_ENV !== "production" &&
        (typeof row.correct === "number" || typeof row.accuracy === "number")
      ) {
        console.warn(`[avg-correct] missing incorrectCount for "${row.name}" in aggregation path.`);
      }

      if (
        process.env.NODE_ENV !== "production" &&
        typeof row.usageUsed === "number" &&
        typeof row.correct === "number" &&
        typeof row.incorrectCount === "number"
      ) {
        const omitted = typeof row.omittedCount === "number" ? row.omittedCount : 0;
        const expectedUsage = row.correct + row.incorrectCount + omitted;
        if (row.usageUsed !== expectedUsage) {
          if (!warnedUsageMismatch.has(bucket.key)) {
            warnedUsageMismatch.add(bucket.key);
            console.warn(
              `[avg-correct] usage mismatch for "${row.name}": usageUsed=${row.usageUsed}, correct+incorrect+omitted=${expectedUsage}`,
            );
          }
        }
      }
    }
  }

  const accumulatorRows = Array.from(byKey.values());
  const attemptedTotalsByCategory = new Map<CategoryType, number>();
  for (const row of accumulatorRows) {
    const attempted = row.qbankCorrectSum + row.qbankIncorrectSum;
    if (attempted <= 0) {
      continue;
    }
    attemptedTotalsByCategory.set(
      row.categoryType,
      (attemptedTotalsByCategory.get(row.categoryType) ?? 0) + attempted,
    );
  }

  return accumulatorRows.map((row) => {
    const attempted = row.qbankCorrectSum + row.qbankIncorrectSum;
    const total = attemptedTotalsByCategory.get(row.categoryType) ?? 0;
    const usageWeight = attempted > 0 && total > 0 ? attempted / total : null;
    return finalizeAccumulator(row, usageWeight);
  });
}

function getSectionRows(rows: DisplayRow[], categoryType: CategoryType) {
  return rows.filter((row) => row.categoryType === categoryType);
}

type RankContext = {
  roiRank: number;
  proiRank?: number;
  avgRank?: number;
};

function buildWhatToStudyBullets(row: DisplayRow, ranks: RankContext, hasScoreReport: boolean): string[] {
  const bullets: string[] = [];
  bullets.push(
    typeof row.blueprintWeight === "number"
      ? `Makes up ${formatPercent(row.blueprintWeight)} of the test.`
      : "Blueprint weight unavailable for this category.",
  );

  const hasQbank = hasUsableQbankData(row);
  const hasScoreReportSignal = hasScoreReport && row.hasProi;

  if (!hasQbank && !hasScoreReportSignal) {
    bullets.push("Not enough data yet - add QBank or a score report to prioritize this accurately.");
    return bullets;
  }

  const roiRank = ranks.roiRank;
  const avgRank = ranks.avgRank;
  const proiRank = ranks.proiRank;
  const roiDriverScore = row.hasRoi && roiRank > 0 ? 1 / roiRank : 0;
  const avgDriverScore = typeof avgRank === "number" && avgRank > 0 ? 1 / avgRank : 0;
  const proiDriverScore = hasScoreReportSignal && typeof proiRank === "number" && proiRank > 0 ? 1 / proiRank : 0;
  const maxDriverScore = Math.max(roiDriverScore, avgDriverScore, proiDriverScore);

  if (hasUsableQbankData(row)) {
    let roiMeaning = "improvements here should pay off quickly.";
    if (roiRank <= 3) {
      roiMeaning = "this is a highest-impact ROI signal and likely one of your fastest returns per study hour.";
    } else if (roiRank <= 5) {
      roiMeaning = "this is a high ROI signal with strong expected return.";
    } else if (maxDriverScore === roiDriverScore) {
      roiMeaning = "ROI is the main driver here, so focused question reps should produce measurable gains.";
    }
    bullets.push(`ROI rank #${roiRank} (value ${formatScore(row.roi ?? 0)}): ${roiMeaning}`);
  }

  if (typeof row.avgPercentCorrect === "number" && typeof avgRank === "number") {
    let avgMeaning = "this is lower than most categories, so it's a likely point gain.";
    if (avgRank <= 5) {
      avgMeaning = "this is one of your lowest averages and needs urgent review.";
    } else if (maxDriverScore === avgDriverScore) {
      avgMeaning = "lowest average is the main reason this moved up your priority list.";
    }
    bullets.push(`Avg % Correct rank #${avgRank} at ${formatPercentFrom100(row.avgPercentCorrect)}: ${avgMeaning}`);
  }

  const shouldShowProi =
    hasScoreReportSignal && typeof proiRank === "number" && (row.proi > 0 || proiRank <= 5);
  if (shouldShowProi && typeof proiRank === "number") {
    let proiMeaning = "your score report flagged this as a weaker area than expected.";
    if (proiRank <= 3) {
      proiMeaning = "this is one of your strongest score-report weakness flags.";
    } else if (maxDriverScore === proiDriverScore) {
      proiMeaning = "score-report signal is the main reason this deserves attention now.";
    }
    bullets.push(`Score report PROI rank #${proiRank} (value ${formatScore(row.proi)}): ${proiMeaning}`);
  }

  if (bullets.length === 1) {
    if ((row.blueprintWeight ?? 0) >= 0.15) {
      bullets.push("This is a large share of the test, so even modest gains can move your overall outcome.");
    }
  }

  return bullets;
}

function RankTable({
  title,
  rows,
  mode,
  showProiColumn,
}: {
  title: string;
  rows: DisplayRow[];
  mode: RankingMode;
  showProiColumn: boolean;
}) {
  return (
    <Card title={title} className="print-avoid-break">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Type</th>
              <th className="px-3 py-2">Weight</th>
              {mode === "roi" ? (
                <>
                  <th className="px-3 py-2">ROI (QBank)</th>
                  {showProiColumn ? <th className="px-3 py-2">PROI (Score Report)</th> : null}
                </>
              ) : (
                <th className="px-3 py-2">Avg % Correct</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.categoryType}-${row.name}`} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 text-stone-900">{row.name}</td>
                <td className="px-3 py-2 text-stone-500 text-xs">{CATEGORY_LABEL_BY_TYPE[row.categoryType]}</td>
                <td className="px-3 py-2 text-stone-700">
                  {typeof row.blueprintWeight === "number" ? formatPercent(row.blueprintWeight) : "-"}
                </td>
                {mode === "roi" ? (
                  <>
                    <td className="px-3 py-2 text-stone-700">
                      {hasUsableQbankData(row) ? formatScore(row.roi) : "-"}
                    </td>
                    {showProiColumn ? (
                      <td className="px-3 py-2 text-stone-700">
                        {row.hasProi ? formatScore(row.proi) : PROI_PLACEHOLDER}
                      </td>
                    ) : null}
                  </>
                ) : (
                  <td className="px-3 py-2 text-stone-700">
                    {typeof row.avgPercentCorrect === "number" ? (
                      formatPercentFrom100(row.avgPercentCorrect)
                    ) : (
                      "-"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DebugPanel({
  enabled,
  dataHealthDebug,
  aggregationCoverageDebug,
  step2MappingAudit,
  medicineDebug,
  aggregated,
  rankingMode,
  truthPanelRows,
}: {
  enabled: boolean;
  dataHealthDebug: unknown;
  aggregationCoverageDebug: unknown;
  step2MappingAudit: unknown;
  medicineDebug: { raw: unknown; derived: TruthPanelRow } | null;
  aggregated: DisplayRow[];
  rankingMode: RankingMode;
  truthPanelRows: TruthPanelRow[];
}) {
  if (!enabled) {
    return null;
  }

  return (
    <>
      <Card className="print-hide" title="Data Health">
        <pre className="whitespace-pre-wrap break-words text-xs text-stone-700">
          {JSON.stringify(dataHealthDebug, null, 2)}
        </pre>
      </Card>

      <Card className="print-hide" title="Aggregation Coverage">
        <pre className="whitespace-pre-wrap break-words text-xs text-stone-700">
          {JSON.stringify(aggregationCoverageDebug, null, 2)}
        </pre>
      </Card>

      {step2MappingAudit ? (
        <Card className="print-hide" title="Step 2 Mapping Audit">
          <pre className="whitespace-pre-wrap break-words text-xs text-stone-700">
            {JSON.stringify(step2MappingAudit, null, 2)}
          </pre>
        </Card>
      ) : null}

      {medicineDebug ? (
        <Card className="print-hide">
          <p className="text-xs text-stone-600">
            [debug] Medicine raw: correct={String((medicineDebug.raw as { correct?: number })?.correct ?? "null")},
            incorrect={String((medicineDebug.raw as { incorrect?: number })?.incorrect ?? "null")},
            omitted={String((medicineDebug.raw as { omitted?: number })?.omitted ?? "null")}, usageUsed=
            {String((medicineDebug.raw as { usageUsed?: number })?.usageUsed ?? "null")}, usageTotal=
            {String((medicineDebug.raw as { usageTotal?: number })?.usageTotal ?? "null")}
            {" | "}derived: attempted={medicineDebug.derived.attempted}, accuracy=
            {medicineDebug.derived.accuracyComputed == null ? "null" : medicineDebug.derived.accuracyComputed.toFixed(3)}
            , avgPercent=
            {medicineDebug.derived.avgPercentComputed == null ? "null" : medicineDebug.derived.avgPercentComputed.toFixed(1)}
          </p>
        </Card>
      ) : null}

      <Card className="print-hide">
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-stone-800">Truth Panel</summary>
          <div className="mt-3 overflow-x-auto">
            <pre style={{ fontSize: 12, opacity: 0.8, margin: "8px 0" }}>
              {JSON.stringify(
                {
                  NODE_ENV: process.env.NODE_ENV,
                  rankingMode,
                  aggregatedType: Array.isArray(aggregated) ? "array" : typeof aggregated,
                  aggregatedLen: Array.isArray(aggregated) ? (aggregated?.length ?? null) : null,
                  aggregatedFirst: aggregated?.[0]
                    ? {
                        categoryType: aggregated[0].categoryType,
                        name: aggregated[0].name,
                        blueprintWeight: aggregated[0].blueprintWeight,
                        usageWeight: aggregated[0].usageWeight,
                        roi: aggregated[0].roi,
                        proi: aggregated[0].proi,
                        attemptedCount: aggregated[0].attemptedCount,
                      }
                    : null,
                  truthFirst: truthPanelRows?.[0]
                    ? {
                        displayName: truthPanelRows[0].displayName,
                        sourceType: truthPanelRows[0].sourceType,
                        blueprintWeightUsed: truthPanelRows[0].blueprintWeightUsed,
                        usageWeightUsed: truthPanelRows[0].usageWeightUsed,
                        attempted: truthPanelRows[0].attempted,
                        avgPercentDisplayed: truthPanelRows[0].avgPercentDisplayed,
                        drift: truthPanelRows[0].drift,
                      }
                    : null,
                  displayRowsLen: sortDisplayRows(aggregated, rankingMode)?.length ?? null,
                  truthLen: truthPanelRows?.length ?? null,
                },
                null,
                2,
              )}
            </pre>
            <table className="min-w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 text-left uppercase tracking-wide text-stone-600">
                  <th className="px-2 py-1">displayName</th>
                  <th className="px-2 py-1">sourceType</th>
                  <th className="px-2 py-1">blueprintWeightUsed</th>
                  <th className="px-2 py-1">usageWeightUsed</th>
                  <th className="px-2 py-1">correctCount</th>
                  <th className="px-2 py-1">incorrectCount</th>
                  <th className="px-2 py-1">attempted</th>
                  <th className="px-2 py-1">accuracyComputed</th>
                  <th className="px-2 py-1">avgPercentDisplayed</th>
                  <th className="px-2 py-1">avgPercentComputed</th>
                  <th className="px-2 py-1">drift</th>
                </tr>
              </thead>
              <tbody>
                {truthPanelRows.map((row) => (
                  <tr key={`${row.sourceType}-${row.displayName}`} className="border-b border-stone-100 last:border-0">
                    <td className="px-2 py-1">{row.displayName}</td>
                    <td className="px-2 py-1">{row.sourceType}</td>
                    <td className="px-2 py-1">{row.blueprintWeightUsed == null ? "-" : formatPercent(row.blueprintWeightUsed)}</td>
                    <td className="px-2 py-1">{row.usageWeightUsed == null ? "-" : formatPercent(row.usageWeightUsed)}</td>
                    <td className="px-2 py-1">{row.correctCount}</td>
                    <td className="px-2 py-1">{row.incorrectCount}</td>
                    <td className="px-2 py-1">{row.attempted}</td>
                    <td className="px-2 py-1">{row.accuracyComputed == null ? "-" : row.accuracyComputed.toFixed(4)}</td>
                    <td className="px-2 py-1">{row.avgPercentDisplayed == null ? "-" : row.avgPercentDisplayed.toFixed(1)}</td>
                    <td className="px-2 py-1">{row.avgPercentComputed == null ? "-" : row.avgPercentComputed.toFixed(1)}</td>
                    <td className="px-2 py-1">{row.drift == null ? "-" : row.drift.toFixed(3)}</td>
                  </tr>
                ))}
                {truthPanelRows.length === 0 ? (
                  <tr className="border-b border-stone-100 last:border-0">
                    <td className="px-2 py-2 text-stone-500" colSpan={11}>
                      No truth rows available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
    </>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [rankingMode, setRankingMode] = useState<RankingMode>("roi");
  const [showRestOfData, setShowRestOfData] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const [debugEnabled, setDebugEnabled] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const parsedRows = useSyncExternalStore(subscribeUploadSession, getClientParsedRows, getServerParsedRows);
  const uploadSession = getUploadSession();
  const selectedTest = useMemo<TestType>(() => {
    const fromSession = getUploadSession()?.selectedTest;
    if (fromSession) {
      return fromSession;
    }
    const fromRows = parsedRows.find((row) => row.testType)?.testType;
    return fromRows ?? DEFAULT_TEST_TYPE;
  }, [parsedRows]);
  const rawAggregated = useMemo(() => aggregateRows(parsedRows, selectedTest), [parsedRows, selectedTest]);
  const aggregated = useMemo(() => withUsmleCanonicalCoverage(rawAggregated, selectedTest), [rawAggregated, selectedTest]);
  const categoryOrder = useMemo(() => getCategoryOrderForTest(selectedTest), [selectedTest]);

  const sections = useMemo<TableSection[]>(() => {
    const reportRows =
      selectedTest === "usmle_step2" ? aggregated.filter((row) => isUworldTaxonomyRow(row)) : aggregated;
    const generalRows = sortDisplayRows(reportRows, rankingMode);
    const categorySections = categoryOrder
      .map((categoryType) => ({
        key: categoryType,
        title: `${CATEGORY_LABEL_BY_TYPE[categoryType]} Rank List`,
        rows: sortDisplayRows(getSectionRows(generalRows, categoryType), rankingMode),
      }))
      .filter(
        (section) =>
          section.rows.length > 0 ||
          (selectedTest === "usmle_step2" &&
            (section.key === "uworld_subject" || section.key === "uworld_system")),
      );

    return [
      {
        key: "general",
        title: "General Combined List",
        rows: generalRows,
      },
      ...categorySections,
    ];
  }, [aggregated, categoryOrder, rankingMode, selectedTest]);

  const roiRankedRows = useMemo(() => {
    const baseRows = selectedTest === "usmle_step2" ? aggregated.filter((row) => isUworldTaxonomyRow(row)) : aggregated;
    return sortDisplayRows(baseRows, "roi");
  }, [aggregated, selectedTest]);
  const roiRankedValidRows = useMemo(
    () => roiRankedRows.filter((row) => row.attemptedCount > 0 && typeof row.roi === "number"),
    [roiRankedRows],
  );
  const rankedSystemsByROI = useMemo(
    () => roiRankedValidRows.filter((row) => row.categoryType === "uworld_system"),
    [roiRankedValidRows],
  );
  const topRoiSystems = useMemo(() => rankedSystemsByROI.slice(0, 3), [rankedSystemsByROI]);
  const whatToStudySystems = useMemo(
    () => rankedSystemsByROI.slice(0, WHAT_TO_STUDY_SYSTEMS_N),
    [rankedSystemsByROI],
  );
  const whatToStudyItems = useMemo(() => {
    const combinedTop = roiRankedValidRows.slice(0, WHAT_TO_STUDY_K);
    const byKey = new Map<string, DisplayRow>();
    for (const row of combinedTop) {
      byKey.set(`${row.categoryType}::${row.name}`, row);
    }
    for (const row of whatToStudySystems) {
      byKey.set(`${row.categoryType}::${row.name}`, row);
    }
    return Array.from(byKey.values()).sort((a, b) => {
      const aRoi = a.roi ?? Number.NEGATIVE_INFINITY;
      const bRoi = b.roi ?? Number.NEGATIVE_INFINITY;
      if (bRoi !== aRoi) {
        return bRoi - aRoi;
      }
      return a.name.localeCompare(b.name);
    });
  }, [roiRankedValidRows, whatToStudySystems]);
  const comlexDisplayItems = useMemo(
    () => (selectedTest === "comlex2" ? whatToStudyItems.slice(0, COMLEX_TOP_N) : whatToStudyItems),
    [selectedTest, whatToStudyItems],
  );
  const hasComlexQbankRoiRows = useMemo(
    () =>
      selectedTest === "comlex2" &&
      aggregated.some((row) => row.attemptedCount > 0 && typeof row.roi === "number"),
    [aggregated, selectedTest],
  );
  const big3Roi = useMemo(() => buildBig3Data(aggregated, "roi"), [aggregated]);
  const hasScoreReportData = useMemo(() => {
    const sessionFlag = uploadSession?.scoreReportProvided;
    if (typeof sessionFlag === "boolean") {
      if (!sessionFlag) {
        return false;
      }
    }
    return aggregated.some((bucket) => Number.isFinite(bucket.proi) && bucket.proi > 0);
  }, [parsedRows, uploadSession]);
  const showProiColumn = useMemo(
    () => hasScoreReportData && aggregated.some((row) => row.hasProi),
    [aggregated, hasScoreReportData],
  );
  const isComlexScoreReportOnly = selectedTest === "comlex2" && hasScoreReportData && !hasComlexQbankRoiRows;
  const comlexProiItems = useMemo(
    () =>
      aggregated
        .filter((row) => Number.isFinite(row.proi) && row.proi > 0)
        .sort((a, b) => b.proi - a.proi)
        .slice(0, COMLEX_TOP_N),
    [aggregated],
  );
  const isProiMode = (rankingMode as string) === "proi";
  const activePriorityMetric: "roi" | "proi" = isProiMode && hasScoreReportData ? "proi" : "roi";
  const usmlePriorityRows = useMemo(() => {
    const rows = aggregated.filter((row) => isUworldTaxonomyRow(row));
    if (activePriorityMetric === "proi") {
      return rows
        .filter((row) => row.hasProi && Number.isFinite(row.proi))
        .sort((a, b) => b.proi - a.proi);
    }
    return rows
      .filter((row) => row.attemptedCount > 0 && typeof row.roi === "number")
      .sort((a, b) => (b.roi ?? Number.NEGATIVE_INFINITY) - (a.roi ?? Number.NEGATIVE_INFINITY));
  }, [activePriorityMetric, aggregated]);
  const rankedSubjectsByPriority = useMemo(
    () => usmlePriorityRows.filter((row) => row.categoryType === "uworld_subject"),
    [usmlePriorityRows],
  );
  const rankedSystemsByPriority = useMemo(
    () => usmlePriorityRows.filter((row) => row.categoryType === "uworld_system"),
    [usmlePriorityRows],
  );
  const victoryTopSubject = rankedSubjectsByPriority[0];
  const victoryTopSystems = rankedSystemsByPriority.slice(0, 3);
  const achillesHeelItem = useMemo(() => {
    const topSubject = rankedSubjectsByPriority[0];
    const topSystem = rankedSystemsByPriority[0];
    if (!topSubject) return topSystem;
    if (!topSystem) return topSubject;
    const subjectValue = activePriorityMetric === "proi" ? topSubject.proi : (topSubject.roi ?? Number.NEGATIVE_INFINITY);
    const systemValue = activePriorityMetric === "proi" ? topSystem.proi : (topSystem.roi ?? Number.NEGATIVE_INFINITY);
    return subjectValue >= systemValue ? topSubject : topSystem;
  }, [activePriorityMetric, rankedSubjectsByPriority, rankedSystemsByPriority]);
  const whatToStudyTopSubjects = rankedSubjectsByPriority.slice(0, 3);
  const whatToStudyTopSystems = rankedSystemsByPriority.slice(0, 3);
  const big3RoiKeySet = useMemo(() => {
    const keys = new Set<string>();
    const add = (row?: DisplayRow) => {
      if (!row) return;
      keys.add(`${row.categoryType}::${row.name}`);
    };
    add(big3Roi.medicineRow);
    big3Roi.topSystems.forEach(add);
    add(big3Roi.biostatsRow);
    add(big3Roi.socialRow);
    return keys;
  }, [big3Roi]);
  const step2MappingAudit = useMemo(() => {
    if (selectedTest !== "usmle_step2") {
      return null;
    }

    const entries: Step2MappingAuditEntry[] = parsedRows
      .filter((row) => row.inputSource === "uworld_qbank" || isUworldTaxonomyRow(row))
      .map((row) => {
        const rawLabel = row.originalName ?? row.name;
        const systemResult = canonicalizeSystemLabel(rawLabel);
        const subjectResult = canonicalizeSubjectLabel(rawLabel, { systemCanonical: systemResult.canonical });
        const correct = typeof row.correct === "number" ? row.correct : null;
        const incorrectCount = typeof row.incorrectCount === "number" ? row.incorrectCount : null;
        const attempted = correct != null && incorrectCount != null ? correct + incorrectCount : 0;
        return {
          rawLabel,
          parsedCategoryType: row.categoryType,
          mappedSubject: subjectResult.canonical,
          mappedSystem: systemResult.canonical,
          subjectReason: subjectResult.reason,
          systemReason: systemResult.reason,
          subjectUnmapped: subjectResult.unmapped,
          systemUnmapped: systemResult.unmapped,
          attempted,
          correct,
          incorrectCount,
        };
      });

    const uniqueLabels = Array.from(new Set(entries.map((entry) => entry.rawLabel)));
    const weightCheck = assertStep2CanonicalWeights();
    const outputSubjectRows = aggregated.filter((row) => row.categoryType === "uworld_subject").length;
    const outputSystemRows = aggregated.filter((row) => row.categoryType === "uworld_system").length;

    return {
      totalRawCategoriesEncountered: uniqueLabels.length,
      mappingTable: entries.map((entry) => ({
        rawLabel: entry.rawLabel,
        parsedCategoryType: entry.parsedCategoryType,
        mappedSubject: entry.mappedSubject,
        mappedSystem: entry.mappedSystem,
        subjectReason: entry.subjectReason,
        systemReason: entry.systemReason,
      })),
      unmappedItemsCount: entries.filter((entry) => entry.subjectUnmapped || entry.systemUnmapped).length,
      asserts: {
        subjectWeightsSumPct: weightCheck.subjectSum * 100,
        systemWeightsSumPct: weightCheck.systemSum * 100,
        subjectWeightsNotNormalized: weightCheck.subjectsNotNormalized,
        medicineMidpointOk: weightCheck.medicineMidpointOk,
        systemWeightsSumOk: weightCheck.systemsOk,
        outputIncludesAllSubjects: outputSubjectRows >= STEP2_SUBJECT_CANONICAL.length,
        outputIncludesAllSystems: outputSystemRows >= STEP2_SYSTEM_CANONICAL.length,
      },
    };
  }, [aggregated, parsedRows, selectedTest]);
  const dataHealthDebug = useMemo(() => {
    const getCorrectCount = (row: ParsedRow): number | null => {
      const withAlt = row as ParsedRow & { correctCount?: unknown };
      if (typeof row.correct === "number") {
        return row.correct;
      }
      if (typeof withAlt.correctCount === "number") {
        return withAlt.correctCount;
      }
      return null;
    };
    const getIncorrectCount = (row: ParsedRow): number | null => {
      const withAlt = row as ParsedRow & { incorrect?: unknown };
      if (typeof row.incorrectCount === "number") {
        return row.incorrectCount;
      }
      if (typeof withAlt.incorrect === "number") {
        return withAlt.incorrect;
      }
      return null;
    };
    const getPercentCorrect = (row: ParsedRow): number | null => {
      const withAlt = row as ParsedRow & { avgCorrect?: unknown };
      if (typeof row.accuracy === "number") {
        return row.accuracy;
      }
      if (typeof withAlt.avgCorrect === "number") {
        return withAlt.avgCorrect;
      }
      return null;
    };

    const rowsWithCorrectCount = parsedRows.filter((row) => getCorrectCount(row) != null).length;
    const rowsWithIncorrectCount = parsedRows.filter((row) => getIncorrectCount(row) != null).length;
    const rowsWithBothCounts = parsedRows.filter(
      (row) => getCorrectCount(row) != null && getIncorrectCount(row) != null,
    ).length;
    const rowsWithAttemptedGT0 = parsedRows.filter(
      (row) => {
        const correct = getCorrectCount(row);
        const incorrect = getIncorrectCount(row);
        return correct != null && incorrect != null && correct + incorrect > 0;
      },
    ).length;
    const rowsWithPercentCorrect = parsedRows.filter((row) => getPercentCorrect(row) != null).length;
    const parsedRowsSample = parsedRows.slice(0, 3).map((row) => ({
      categoryType: row.categoryType,
      name: row.name,
      source: row.source ?? null,
      correctCount: getCorrectCount(row),
      incorrectCount: getIncorrectCount(row),
      percentCorrect: getPercentCorrect(row),
    }));

    return {
      parsedRowsTotal: parsedRows.length,
      rowsWithCorrectCount,
      rowsWithIncorrectCount,
      rowsWithBothCounts,
      rowsWithAttemptedGT0,
      rowsWithPercentCorrect,
      aggregatedCategoriesTotal: aggregated.length,
      aggregatedWithAttemptedGT0: aggregated.filter((row) => row.attemptedCount > 0).length,
      aggregatedWithAvgPercentNonNull: aggregated.filter((row) => typeof row.avgPercentCorrect === "number").length,
      parsedRowsSample,
    };
  }, [aggregated, parsedRows]);
  const aggregationCoverageDebug = useMemo(() => {
    const getCorrectCount = (row: ParsedRow): number | null => {
      const withAlt = row as ParsedRow & { correctCount?: unknown };
      if (typeof row.correct === "number") {
        return row.correct;
      }
      if (typeof withAlt.correctCount === "number") {
        return withAlt.correctCount;
      }
      return null;
    };
    const getIncorrectCount = (row: ParsedRow): number | null => {
      const withAlt = row as ParsedRow & { incorrect?: unknown };
      if (typeof row.incorrectCount === "number") {
        return row.incorrectCount;
      }
      if (typeof withAlt.incorrect === "number") {
        return withAlt.incorrect;
      }
      return null;
    };

    const attemptedRows = parsedRows
      .map((row) => {
        const correct = getCorrectCount(row);
        const incorrect = getIncorrectCount(row);
        const attempted = correct != null && incorrect != null ? correct + incorrect : 0;
        const hasAttempted = attempted > 0;
        const hasCountAccuracy = typeof correct === "number" && typeof incorrect === "number" && incorrect >= 0;
        const step2Buckets =
          selectedTest === "usmle_step2" && (row.inputSource === "uworld_qbank" || isUworldTaxonomyRow(row))
            ? getStep2BucketsForRow(row, hasCountAccuracy)
            : [];
        const bucketKeys =
          hasAttempted && step2Buckets.length > 0
            ? step2Buckets.map((bucket) => bucket.key)
            : hasAttempted
              ? [resolveAggregationBucket(row, hasCountAccuracy)?.key].filter((value): value is string => Boolean(value))
              : [];
        return { row, correct, incorrect, attempted, bucketKeys };
      })
      .filter((entry) => entry.attempted > 0);

    const aggregatedAttemptedByKey = new Map<string, number>();
    for (const row of aggregated) {
      aggregatedAttemptedByKey.set(`${row.categoryType}::${row.name}`, row.attemptedCount);
    }

    const droppedRows = attemptedRows
      .filter((entry) => {
        if (entry.bucketKeys.length === 0) {
          return true;
        }
        return entry.bucketKeys.every((key) => (aggregatedAttemptedByKey.get(key) ?? 0) <= 0);
      })
      .map((entry) => ({
        categoryType: entry.row.categoryType,
        name: entry.row.name,
        correct: entry.correct,
        incorrectCount: entry.incorrect,
        attempted: entry.attempted,
        mappingKey: entry.bucketKeys.length > 0 ? entry.bucketKeys.join(", ") : null,
      }));

    return {
      attemptedParsedRowCount: attemptedRows.length,
      attemptedAggregatedSum: aggregated.reduce((sum, row) => sum + row.attemptedCount, 0),
      droppedRows,
      attemptedAggregatedBuckets: aggregated
        .filter((row) => row.attemptedCount > 0)
        .map((row) => ({
          categoryType: row.categoryType,
          name: row.name,
          attempted: row.attemptedCount,
          blueprintWeight: row.blueprintWeight,
          usageWeight: row.usageWeight,
          roi: row.roi,
        })),
    };
  }, [aggregated, parsedRows, selectedTest]);
  const unmappedGroups = useMemo<UnmappedRowGroup[]>(() => {
    const map = new Map<string, UnmappedRowGroup>();
    for (const row of parsedRows) {
      const requiresBlueprintMapping = !(selectedTest === "usmle_step2" && (row.inputSource === "uworld_qbank" || isUworldTaxonomyRow(row)));
      if (!requiresBlueprintMapping) {
        continue;
      }
      if (!row.unmapped && row.weight != null) {
        continue;
      }
      const originalName = row.originalName ?? row.name;
      const source = row.source ?? "unknown";
      const key = `${originalName}::${row.categoryType}::${source}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          originalName,
          categoryType: row.categoryType,
          source,
          count: 1,
          examples: [row.name],
        });
        continue;
      }
      existing.count += 1;
      if (existing.examples.length < 3 && !existing.examples.includes(row.name)) {
        existing.examples.push(row.name);
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [parsedRows, selectedTest]);
  const mappingFailureRate = useMemo(() => {
    const qbankRows = parsedRows.filter(
      (row) =>
        (typeof row.accuracy === "number" || (typeof row.correct === "number" && typeof row.total === "number")) &&
        !(selectedTest === "usmle_step2" && (row.inputSource === "uworld_qbank" || isUworldTaxonomyRow(row))),
    );
    if (qbankRows.length === 0) {
      return 0;
    }
    const failed = qbankRows.filter((row) => row.weight == null || row.unmapped).length;
    return failed / qbankRows.length;
  }, [parsedRows, selectedTest]);
  const zeusRows = useMemo<ZeusContextRow[]>(
    () =>
      aggregated.map((row) => ({
        name: row.name,
        categoryType: row.categoryType,
        weight: row.blueprintWeight ?? 0,
        roi: row.roi ?? 0,
        proi: row.hasProi ? row.proi : 0,
        avgCorrect: typeof row.avgCorrect === "number" ? row.avgCorrect : null,
      })),
    [aggregated],
  );
  const roiRankMap = useMemo(() => {
    const map = new Map<string, number>();
    sortDisplayRows([...aggregated], "roi").forEach((row, index) => {
      map.set(`${row.categoryType}::${row.name}`, index + 1);
    });
    return map;
  }, [aggregated]);
  const avgRankMap = useMemo(() => {
    const map = new Map<string, number>();
    sortDisplayRows([...aggregated], "avg").forEach((row, index) => {
      map.set(`${row.categoryType}::${row.name}`, index + 1);
    });
    return map;
  }, [aggregated]);
  const proiRankMap = useMemo(() => {
    const map = new Map<string, number>();
    [...aggregated]
      .filter((row) => row.hasProi)
      .sort((a, b) => b.proi - a.proi)
      .forEach((row, index) => {
        map.set(`${row.categoryType}::${row.name}`, index + 1);
      });
    return map;
  }, [aggregated]);
  const zeusContext = useMemo<ZeusContext>(() => {
    const toRanked = (rows: DisplayRow[], scoreKey: "roi" | "proi" | "focusScore" | "avgCorrect") =>
      rows.map((row, index) => ({
        rank: index + 1,
        name: row.name,
        categoryType: row.categoryType,
        score:
          scoreKey === "avgCorrect"
            ? typeof row.avgCorrect === "number"
              ? row.avgCorrect
              : Number.POSITIVE_INFINITY
            : typeof row[scoreKey] === "number"
              ? row[scoreKey]
              : Number.NEGATIVE_INFINITY,
      }));

    const roiOrdered = sortDisplayRows([...aggregated], "roi");
    const avgOrdered = sortDisplayRows([...aggregated], "avg");
    const proiOrdered = [...aggregated].filter((row) => row.hasProi).sort((a, b) => b.proi - a.proi);
    const combinedOrdered = sortByFocusScore([...aggregated]);

    return {
      exam: selectedTest,
      rows: zeusRows,
      topFive: whatToStudyItems.map((row) => ({
        name: row.name,
        categoryType: row.categoryType,
        weight: row.blueprintWeight ?? 0,
        roi: row.roi ?? 0,
        proi: row.hasProi ? row.proi : 0,
        avgCorrect: typeof row.avgCorrect === "number" ? row.avgCorrect : null,
      })),
      roiRanking: toRanked(roiOrdered, "roi"),
      avgCorrectRanking: toRanked(avgOrdered, "avgCorrect"),
      proiRanking: toRanked(proiOrdered, "proi"),
      combinedRanking: toRanked(combinedOrdered, "focusScore"),
    };
  }, [aggregated, selectedTest, whatToStudyItems, zeusRows]);
  const truthPanelRows = useMemo<TruthPanelRow[]>(() => {
    if (!debugEnabled) {
      return [];
    }
    const generalRows = sortDisplayRows(aggregated, rankingMode);
    const requiredNames = new Set(["Medicine", "Pediatrics", "Pregnancy/Childbirth & the Puerperium"]);
    const candidates = [...generalRows.slice(0, 10)];
    for (const name of requiredNames) {
      const found = generalRows.find((row) => row.name === name);
      if (found && !candidates.some((row) => row.categoryType === found.categoryType && row.name === found.name)) {
        candidates.push(found);
      }
    }
    return candidates.map((row) => {
      const attempted = row.qbankCorrectSum + row.qbankIncorrectSum;
      const accuracyComputed = computeAccuracy(row.qbankCorrectSum, row.qbankIncorrectSum);
      const avgPercentComputed = computeAvgPercentCorrect(row.qbankCorrectSum, row.qbankIncorrectSum);
      const avgPercentDisplayed =
        typeof row.avgPercentCorrect === "number" ? row.avgPercentCorrect : null;
      const drift =
        avgPercentDisplayed != null && avgPercentComputed != null
          ? avgPercentDisplayed - avgPercentComputed
          : null;
      return {
        displayName: row.name,
        sourceType: row.categoryType,
        blueprintWeightUsed: row.blueprintWeight,
        usageWeightUsed: row.usageWeight,
        correctCount: row.qbankCorrectSum,
        incorrectCount: row.qbankIncorrectSum,
        attempted,
        accuracyComputed,
        avgPercentDisplayed,
        avgPercentComputed,
        drift,
      };
    });
  }, [aggregated, debugEnabled, rankingMode]);

  useEffect(() => {
    if (!debugEnabled) {
      return;
    }
    for (const row of truthPanelRows) {
      if (row.attempted > 0 && row.drift != null && Math.abs(row.drift) > 0.5) {
        console.warn("[truth-panel] avgPercent drift detected", row);
      }
      if (row.avgPercentDisplayed != null && (row.avgPercentDisplayed < 0 || row.avgPercentDisplayed > 100)) {
        console.error("[truth-panel] avgPercent out of bounds", row);
      }
    }
  }, [debugEnabled, truthPanelRows]);

  const medicineDebug = useMemo(() => {
    if (!debugEnabled) {
      return null;
    }
    const row = truthPanelRows.find((entry) => entry.displayName === "Medicine");
    if (!row) {
      return null;
    }
    const medicineRows = parsedRows.filter(
        (item) =>
          item.categoryType === "uworld_subject" &&
        (item.name === "Medicine" || item.originalName === "Medicine" || item.originalName === "Internal Medicine"),
    );
    const raw = medicineRows.reduce(
      (acc, item) => ({
        correct: acc.correct + (typeof item.correct === "number" ? item.correct : 0),
        incorrect: acc.incorrect + (typeof item.incorrectCount === "number" ? item.incorrectCount : 0),
        omitted: acc.omitted + (typeof item.omittedCount === "number" ? item.omittedCount : 0),
        usageUsed: acc.usageUsed + (typeof item.usageUsed === "number" ? item.usageUsed : 0),
        usageTotal: acc.usageTotal + (typeof item.usageTotal === "number" ? item.usageTotal : 0),
      }),
      { correct: 0, incorrect: 0, omitted: 0, usageUsed: 0, usageTotal: 0 },
    );
    return { raw, derived: row };
  }, [debugEnabled, parsedRows, truthPanelRows]);

  useEffect(() => {
    if (typeof window === "undefined" || process.env.NODE_ENV === "production") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const queryEnabled = params.get("debug") === "1";
    const storedEnabled = window.localStorage.getItem("achilles_debug") === "1";
    setDebugEnabled(queryEnabled || storedEnabled);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || selectedTest !== "usmle_step2") {
      return;
    }

    const expectedSubjectWeightsPct: Record<string, number> = {
      Medicine: 60.0,
      Surgery: 25.0,
      Pediatrics: 22.0,
      "Obstetrics & Gynecology": 15.0,
      Psychiatry: 12.5,
    };

    for (const [name, expectedPct] of Object.entries(expectedSubjectWeightsPct)) {
      const actual = STEP2_SUBJECT_WEIGHTS[name as keyof typeof STEP2_SUBJECT_WEIGHTS] ?? null;
      if (actual == null || Math.abs(actual * 100 - expectedPct) > 1e-6) {
        console.warn(
          `[step2-assert] Subject weight mismatch for "${name}". Expected ${expectedPct}%, got ${actual == null ? "null" : (actual * 100).toFixed(3)}%.`,
        );
      }
    }

    const medicineRow = aggregated.find((row) => row.categoryType === "uworld_subject" && row.name === "Medicine");
    if (
      medicineRow &&
      typeof medicineRow.avgPercentCorrect === "number" &&
      typeof medicineRow.roi === "number" &&
      medicineRow.attemptedCount > 0
    ) {
      const expectedRoi = (1 - medicineRow.avgPercentCorrect / 100) * 0.6;
      if (Math.abs(medicineRow.roi - expectedRoi) > 1e-9) {
        console.warn(
          `[step2-assert] Medicine ROI drift. expected=${expectedRoi.toFixed(6)} actual=${medicineRow.roi.toFixed(6)}`,
        );
      }
    }

    const systemRows = aggregated.filter((row) => row.categoryType === "uworld_system");
    if (systemRows.length !== STEP2_SYSTEM_CANONICAL.length) {
      console.warn(
        `[step2-assert] Systems row count mismatch. expected=${STEP2_SYSTEM_CANONICAL.length} actual=${systemRows.length}`,
      );
    }

    const studySubjectKeySet = new Set(
      whatToStudyItems
        .filter((row) => row.categoryType === "uworld_subject")
        .map((row) => `${row.categoryType}::${row.name}`),
    );
    const studySystemKeySet = new Set(
      whatToStudySystems
        .filter((row) => row.categoryType === "uworld_system")
        .map((row) => `${row.categoryType}::${row.name}`),
    );
    const topSubjectByRoi = roiRankedValidRows.find(
      (row) => row.categoryType === "uworld_subject" && row.attemptedCount > 0 && typeof row.roi === "number",
    );
    if (topSubjectByRoi && !studySubjectKeySet.has(`${topSubjectByRoi.categoryType}::${topSubjectByRoi.name}`)) {
      console.warn(`[step2-assert] Top ROI subject missing from What to study: ${topSubjectByRoi.name}`);
    }

    for (const row of topRoiSystems) {
      const key = `${row.categoryType}::${row.name}`;
      if (!studySystemKeySet.has(key)) {
        console.warn(`[step2-assert] Top ROI system missing from What to study: ${row.name}`);
      }
    }

    const multisystemRank = roiRankedValidRows.findIndex(
      (row) => row.categoryType === "uworld_system" && row.name === "Multisystem Processes & Disorders",
    );
    if (multisystemRank >= WHAT_TO_STUDY_SYSTEMS_N && studySystemKeySet.has("uworld_system::Multisystem Processes & Disorders")) {
      console.warn("[step2-assert] Multisystem appears in What to study despite low ROI rank among systems.");
    }
  }, [aggregated, roiRankedValidRows, selectedTest, topRoiSystems, whatToStudyItems, whatToStudySystems]);

  useEffect(() => {
    if (!chatScrollRef.current) {
      return;
    }
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
  }, [chatMessages, isChatLoading]);

  const onSendChat = async () => {
    const message = chatInput.trim();
    if (!message || isChatLoading) {
      return;
    }

    const isFirstUserMessage = chatMessages.every((entry) => entry.role !== "user");
    setChatError("");
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", content: message }]);
    setIsChatLoading(true);

    try {
      const response = await fetch("/api/zeus", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          firstUserMessage: isFirstUserMessage,
          context: zeusContext,
        }),
      });

      if (!response.ok) {
        throw new Error("ZEUS_REQUEST_FAILED");
      }

      const data = (await response.json()) as { reply?: string };
      const reply = (data.reply ?? "").trim();
      if (!reply) {
        throw new Error("ZEUS_EMPTY_REPLY");
      }

      setChatMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setChatError("Zeus couldn't respond. Try again.");
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleExportPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };
  const isDevNoSession = process.env.NODE_ENV !== "production" && parsedRows.length === 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (process.env.NODE_ENV === "production" && parsedRows.length === 0) {
    return (
      <section className="space-y-8 pt-6 sm:pt-10">
        <BrandHeader subtitle="No results session found." />
        <Card title="Results unavailable">
          <p className="text-sm text-stone-700">Analyze data from the upload page first.</p>
          <div className="pt-2">
            <Link
              href="/upload"
              className="inline-flex items-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Back to Upload
            </Link>
          </div>
        </Card>
      </section>
    );
  }

  if (!mounted) {
    return (
      <section className="space-y-6 pt-6 sm:pt-10">
        <BrandHeader />
        <div id="results-print-root" className="space-y-6">
          <Card className="print-avoid-break">
            <h2 className="brand-title text-2xl font-semibold text-stone-900">RESULTS: Loading...</h2>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 pt-6 sm:pt-10">
      <BrandHeader />
      {isDevNoSession ? (
        <Alert variant="error">
          DEV MODE: no results session found â€” showing empty debug view.
        </Alert>
      ) : null}
      <div id="results-print-root" className="space-y-6">
      <Card className="print-avoid-break">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="brand-title text-2xl font-semibold text-stone-900">RESULTS: {getTestLabel(selectedTest)}</h2>
          <div className="print-hide flex flex-wrap items-center gap-2 md:justify-center">
            {(Object.keys(modeLabels) as RankingMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRankingMode(mode)}
                aria-pressed={rankingMode === mode}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                  rankingMode === mode
                    ? "cursor-pointer border-stone-800 bg-stone-800 text-amber-50"
                    : "cursor-pointer border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                }`}
              >
                {modeLabels[mode]}
              </button>
            ))}
            <button
              type="button"
              onClick={handleExportPdf}
              className="cursor-pointer rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Export PDF
            </button>
          </div>
        </div>

        <div className="space-y-1 text-sm text-stone-700">
          <p>ROI = (1 - accuracy) x weight</p>
          <p className="text-stone-600">
            Higher ROI = bigger score gain if you improve this category (from QBank performance).
          </p>
          {showProiColumn ? (
            <>
              <p>PROI = (proxyWeakness) x weight</p>
              <p className="text-stone-600">
                Higher PROI = bigger score gain if you improve this category (estimated from score report graph bars).
              </p>
              <p className="text-stone-600">
                Score reports don&apos;t provide per-category correct/total, so proxyWeakness is extracted from the score
                report graphs.
              </p>
            </>
          ) : null}
        </div>
      </Card>

      <DebugPanel
        enabled={debugEnabled}
        dataHealthDebug={dataHealthDebug}
        aggregationCoverageDebug={aggregationCoverageDebug}
        step2MappingAudit={step2MappingAudit}
        medicineDebug={medicineDebug}
        aggregated={aggregated}
        rankingMode={rankingMode}
        truthPanelRows={truthPanelRows}
      />

      {mappingFailureRate > 0.05 ? (
        <Alert variant="error">
          {`Mapping failed â€” many categories could not be matched to the ${getTestLabel(selectedTest)} blueprint. This is a bug. Please re-upload or report.`}
        </Alert>
      ) : null}

      {selectedTest === "usmle_step2" ? (
        <>
          <Card title="VICTORY" className="print-avoid-break">
            <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
              <p className="text-xs uppercase tracking-wide text-stone-500">
                Active metric: {activePriorityMetric === "proi" ? "PROI" : "ROI"}
              </p>
              <p className="mt-2 font-semibold text-stone-900">Top Subject</p>
              {victoryTopSubject ? (
                <p>
                  {victoryTopSubject.name} | {activePriorityMetric === "proi" ? "PROI" : "ROI"}: {" "}
                  {activePriorityMetric === "proi"
                    ? formatScore(victoryTopSubject.proi)
                    : hasUsableQbankData(victoryTopSubject)
                      ? formatScore(victoryTopSubject.roi)
                      : "— (insufficient QBank data)"}{" "}
                  | Weight: {" "}
                  {victoryTopSubject.blueprintWeight == null ? "—" : formatPercent(victoryTopSubject.blueprintWeight)}{" "}
                  | Avg % Correct: {" "}
                  {typeof victoryTopSubject.avgPercentCorrect === "number"
                    ? formatPercentFrom100(victoryTopSubject.avgPercentCorrect)
                    : "— (insufficient QBank data)"}
                </p>
              ) : (
                <p>— (insufficient QBank data)</p>
              )}

              <p className="mt-3 font-semibold text-stone-900">Top 3 Systems</p>
              <ul className="list-disc pl-5">
                {victoryTopSystems.map((row, index) => (
                  <li key={`victory-system-${row.name}`}>
                    #{index + 1} {row.name} | {activePriorityMetric === "proi" ? "PROI" : "ROI"}: {" "}
                    {activePriorityMetric === "proi"
                      ? formatScore(row.proi)
                      : hasUsableQbankData(row)
                        ? formatScore(row.roi)
                        : "— (insufficient QBank data)"}{" "}
                    | Weight: {row.blueprintWeight == null ? "—" : formatPercent(row.blueprintWeight)} | Avg % Correct:{" "}
                    {typeof row.avgPercentCorrect === "number"
                      ? formatPercentFrom100(row.avgPercentCorrect)
                      : "— (insufficient QBank data)"}
                  </li>
                ))}
                {victoryTopSystems.length === 0 ? <li>— (insufficient QBank data)</li> : null}
              </ul>
            </div>
          </Card>

          <Card title="ACHILLES HEEL" className="print-avoid-break">
            {achillesHeelItem ? (
              <div className="space-y-2 rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                <p className="font-semibold text-stone-900">
                  {achillesHeelItem.name} ({CATEGORY_LABEL_BY_TYPE[achillesHeelItem.categoryType]})
                </p>
                <p>
                  Rank #
                  {activePriorityMetric === "proi"
                    ? (proiRankMap.get(`${achillesHeelItem.categoryType}::${achillesHeelItem.name}`) ?? "—")
                    : (roiRankMap.get(`${achillesHeelItem.categoryType}::${achillesHeelItem.name}`) ?? "—")} |{" "}
                  {activePriorityMetric === "proi" ? "PROI" : "ROI"}:{" "}
                  {activePriorityMetric === "proi"
                    ? formatScore(achillesHeelItem.proi)
                    : hasUsableQbankData(achillesHeelItem)
                      ? formatScore(achillesHeelItem.roi)
                      : "— (insufficient QBank data)"}{" "}
                  | Weight: {" "}
                  {achillesHeelItem.blueprintWeight == null ? "—" : formatPercent(achillesHeelItem.blueprintWeight)} | Avg % Correct:{" "}
                  {typeof achillesHeelItem.avgPercentCorrect === "number"
                    ? formatPercentFrom100(achillesHeelItem.avgPercentCorrect)
                    : "— (insufficient QBank data)"}
                </p>
                <p className="text-stone-600">
                  This item is currently your highest-priority target because it combines exam weight and current
                  performance gap under the active metric.
                </p>
              </div>
            ) : (
              <p className="text-sm text-stone-700">— (insufficient QBank data)</p>
            )}
          </Card>

          <Card title="WHAT TO STUDY" className="print-avoid-break">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                <p className="font-semibold text-stone-900">Top 3 Subjects</p>
                <ul className="mt-2 space-y-1">
                  {whatToStudyTopSubjects.map((row, index) => (
                    <li key={`study-subject-${row.name}`}>
                      #{index + 1} {row.name} | {activePriorityMetric === "proi" ? "PROI" : "ROI"}: {" "}
                      {activePriorityMetric === "proi"
                        ? formatScore(row.proi)
                        : hasUsableQbankData(row)
                          ? formatScore(row.roi)
                          : "— (insufficient QBank data)"}
                    </li>
                  ))}
                  {whatToStudyTopSubjects.length === 0 ? <li>— (insufficient QBank data)</li> : null}
                </ul>
              </div>
              <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                <p className="font-semibold text-stone-900">Top 3 Systems</p>
                <ul className="mt-2 space-y-1">
                  {whatToStudyTopSystems.map((row, index) => (
                    <li key={`study-system-${row.name}`}>
                      #{index + 1} {row.name} | {activePriorityMetric === "proi" ? "PROI" : "ROI"}: {" "}
                      {activePriorityMetric === "proi"
                        ? formatScore(row.proi)
                        : hasUsableQbankData(row)
                          ? formatScore(row.roi)
                          : "— (insufficient QBank data)"}
                    </li>
                  ))}
                  {whatToStudyTopSystems.length === 0 ? <li>— (insufficient QBank data)</li> : null}
                </ul>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <>
          <Card title="Achilles Insight" className="print-avoid-break">
            {isComlexScoreReportOnly ? (
              <p className="mb-3 text-sm text-stone-600">
                ROI not available (no QBank data submitted). Showing PROI (score-report proxy) instead.
              </p>
            ) : null}
            <ul className="space-y-4 text-sm text-stone-800">
              {(isComlexScoreReportOnly ? comlexProiItems : comlexDisplayItems).map((row) => (
                <li key={`insight-${row.categoryType}-${row.name}`} className="rounded-md border border-stone-200 bg-stone-50/40 p-3">
                  <p className="font-semibold text-stone-900">
                    {row.name} ({CATEGORY_LABEL_BY_TYPE[row.categoryType]})
                  </p>
                  {(() => {
                    const showROI =
                      hasComlexQbankRoiRows &&
                      typeof row.roi === "number" &&
                      Number.isFinite(row.roi);
                    const showPROI =
                      hasScoreReportData &&
                      typeof row.proi === "number" &&
                      Number.isFinite(row.proi);
                    return (
                      <p>
                        Weight: {row.blueprintWeight == null ? "-" : formatPercent(row.blueprintWeight)}
                        {showROI ? ` | ROI: ${formatScore(row.roi as number)}` : ""}
                        {showPROI ? ` | PROI: ${formatScore(row.proi)}` : ""}
                        {" | "}Avg % Correct:{" "}
                        {typeof row.avgPercentCorrect === "number" && Number.isFinite(row.avgPercentCorrect)
                          ? formatPercentFrom100(row.avgPercentCorrect)
                          : "-"}
                      </p>
                    );
                  })()}
                </li>
              ))}
              {(isComlexScoreReportOnly ? comlexProiItems : comlexDisplayItems).length === 0 ? (
                <li className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-stone-600">-</li>
              ) : null}
            </ul>
          </Card>

          <Card title="WHAT TO STUDY?" className="print-avoid-break">
            {isComlexScoreReportOnly ? (
              <p className="mb-3 text-sm text-stone-600">
                Upload QBank data to enable ROI (accuracy-based) rankings.
              </p>
            ) : null}
            <ul className="space-y-4 text-sm text-stone-800">
              {(isComlexScoreReportOnly ? comlexProiItems : comlexDisplayItems).map((row) => (
                <li key={`study-${row.categoryType}-${row.name}`} className="rounded-md border border-stone-200 bg-stone-50/40 p-3">
                  <p className="font-semibold text-stone-900">
                    {row.name} ({CATEGORY_LABEL_BY_TYPE[row.categoryType]})
                    {!isComlexScoreReportOnly && big3RoiKeySet.has(`${row.categoryType}::${row.name}`) ? (
                      <span className="ml-2 inline-flex items-center rounded border border-stone-300 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-600">
                        In Big-3
                      </span>
                    ) : null}
                  </p>
                  {(() => {
                    const qbankPresent = hasComlexQbankRoiRows;
                    const hasRoi = qbankPresent && typeof row.roi === "number" && Number.isFinite(row.roi);
                    const hasProi = typeof row.proi === "number" && Number.isFinite(row.proi);
                    const hasAvg = typeof row.avgPercentCorrect === "number" && Number.isFinite(row.avgPercentCorrect);
                    const roiFmt = hasRoi ? formatScore(row.roi as number) : "-";
                    const proiFmt = hasProi ? formatScore(row.proi) : "-";
                    const weightPct = typeof row.blueprintWeight === "number" ? formatPercent(row.blueprintWeight) : "-";
                    const avgPct = hasAvg ? formatPercentFrom100(row.avgPercentCorrect as number) : "-";
                    return (
                      <ul className="list-disc pl-5">
                        {hasRoi ? (
                          <li>Your QBank results show this area can return value quickly (ROI {roiFmt}).</li>
                        ) : null}
                        <li>This category carries {weightPct} of blueprint weight, so progress here matters.</li>
                        {hasAvg ? <li>Avg % Correct is {avgPct}, which helps set urgency.</li> : null}
                        {hasProi ? <li>Score report graph bars also flag this area (PROI {proiFmt}).</li> : null}
                      </ul>
                    );
                  })()}
                </li>
              ))}
              {(isComlexScoreReportOnly ? comlexProiItems : comlexDisplayItems).length === 0 ? (
                <li className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-stone-600">-</li>
              ) : null}
            </ul>
          </Card>
        </>
      )}
{unmappedGroups.length > 0 ? (
        <Card title="Unmapped Categories" className="print-avoid-break">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-600">
                  <th className="px-3 py-2">Original Name</th>
                  <th className="px-3 py-2">Category Type</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Count</th>
                  <th className="px-3 py-2">Example Rows</th>
                </tr>
              </thead>
              <tbody>
                {unmappedGroups.map((group) => (
                  <tr key={`${group.originalName}-${group.categoryType}-${group.source}`} className="border-b border-stone-100 last:border-0">
                    <td className="px-3 py-2 text-stone-900">
                      <div>{group.originalName}</div>
                      {process.env.NODE_ENV !== "production" ? (
                        <details className="mt-1 text-xs text-stone-500">
                          <summary className="cursor-pointer select-none">debug</summary>
                          <pre className="whitespace-pre-wrap break-words">
                            {`json: ${JSON.stringify(group.originalName)}\ncharCodes: ${Array.from(group.originalName)
                              .slice(0, 40)
                              .map((char) => char.charCodeAt(0))
                              .join(",")}`}
                          </pre>
                        </details>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-stone-700">{group.categoryType}</td>
                    <td className="px-3 py-2 text-stone-700">{group.source}</td>
                    <td className="px-3 py-2 text-stone-700">{group.count}</td>
                    <td className="px-3 py-2 text-stone-700">{group.examples.join(" | ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <div className="print-hide flex justify-center">
        <button
          type="button"
          onClick={() => setShowRestOfData((prev) => !prev)}
          className="cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
        >
          {showRestOfData ? "Hide rest of data" : "See rest of data"}
        </button>
      </div>

      <Card title="ZEUS" className="print-hide mx-auto w-full max-w-3xl">
        <p className="text-sm text-stone-600">Ask Zeus what to do next based on your data.</p>
        <div ref={chatScrollRef} className="max-h-72 space-y-3 overflow-y-auto rounded-md border border-stone-200 bg-stone-50/40 p-3">
          {chatMessages.map((message, index) => (
            <div key={`zeus-msg-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[70%] rounded-md border px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "border-stone-300 bg-stone-200 text-stone-900"
                    : "border-stone-200 bg-white text-stone-800"
                }`}
              >
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {message.role === "user" ? "YOU" : "ZEUS"}
                </p>
                <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {isChatLoading ? <p className="text-sm text-stone-600">Zeus is thinking...</p> : null}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void onSendChat();
              }
            }}
            placeholder="Ask Zeus what to do next..."
            className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          />
          <button
            type="button"
            disabled={isChatLoading || !chatInput.trim()}
            onClick={() => void onSendChat()}
            className="cursor-pointer rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </div>
        {chatError ? <p className="text-sm text-red-700">{chatError}</p> : null}
      </Card>

      <div className={showRestOfData ? "space-y-6" : "hidden print:block print:space-y-6"}>
        {sections.map((section) => (
          <RankTable
            key={section.key}
            title={section.title}
            rows={section.rows}
            mode={rankingMode}
            showProiColumn={showProiColumn}
          />
        ))}
      </div>

      <div className="print-hide pt-2">
        <button
          type="button"
          onClick={() => {
            clearUploadSession();
            router.push("/upload");
          }}
          className="inline-flex items-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          Start over
        </button>
      </div>
      </div>
    </section>
  );
}




