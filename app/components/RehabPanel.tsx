"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORY_LABEL_BY_TYPE } from "../lib/blueprint";
import type { RehabCategoryRecord, RehabMetricKey, RehabRunRecord, RehabSnapshotsResponse } from "../lib/rehab";
import { rehabMetricDisplayName, toRehabProgressValue } from "../lib/rehab";
import { getTestLabel } from "../lib/testSelection";
import type { CategoryType, TestType } from "../lib/types";
import { Alert } from "./Alert";
import { Card } from "./Card";

type RehabPanelProps = {
  examMode: TestType;
  refreshVersion?: number;
};

type CategoryOption = {
  key: string;
  categoryName: string;
  categoryType: CategoryType;
  label: string;
};

type TrendTarget = "overall" | string;

type SeriesPoint = {
  runId: string;
  snapshotAt: string;
  rawValue: number;
  progressValue: number;
};

type SeriesDefinition = {
  metric: RehabMetricKey;
  color: string;
  label: string;
  rawLabel: string;
  valuesByRunId: Map<string, SeriesPoint>;
};

const SERIES_COLORS: Record<RehabMetricKey, string> = {
  roi: "#1d4ed8",
  proi: "#b45309",
  avg_percent_correct: "#047857",
};

function formatDateLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTimeLabel(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMetricRaw(metric: RehabMetricKey, value: number) {
  if (metric === "avg_percent_correct") {
    return `${value.toFixed(1)}%`;
  }
  return value.toFixed(3);
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return "";
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function getOverallSeries(runs: RehabRunRecord[]): SeriesDefinition[] {
  const roi = new Map<string, SeriesPoint>();
  const proi = new Map<string, SeriesPoint>();
  const avg = new Map<string, SeriesPoint>();

  for (const run of runs) {
    if (run.hasQbankData && typeof run.overallRoi === "number" && Number.isFinite(run.overallRoi)) {
      roi.set(run.id, {
        runId: run.id,
        snapshotAt: run.snapshotAt,
        rawValue: run.overallRoi,
        progressValue: toRehabProgressValue("roi", run.overallRoi),
      });
    }
    if (run.hasScoreReportData && typeof run.overallProi === "number" && Number.isFinite(run.overallProi)) {
      proi.set(run.id, {
        runId: run.id,
        snapshotAt: run.snapshotAt,
        rawValue: run.overallProi,
        progressValue: toRehabProgressValue("proi", run.overallProi),
      });
    }
    if (
      run.hasQbankData &&
      typeof run.overallAvgPercentCorrect === "number" &&
      Number.isFinite(run.overallAvgPercentCorrect)
    ) {
      avg.set(run.id, {
        runId: run.id,
        snapshotAt: run.snapshotAt,
        rawValue: run.overallAvgPercentCorrect,
        progressValue: toRehabProgressValue("avg_percent_correct", run.overallAvgPercentCorrect),
      });
    }
  }

  return [
    {
      metric: "roi",
      color: SERIES_COLORS.roi,
      label: `${rehabMetricDisplayName("roi")} (inverted for progress view)`,
      rawLabel: "ROI",
      valuesByRunId: roi,
    },
    {
      metric: "proi",
      color: SERIES_COLORS.proi,
      label: `${rehabMetricDisplayName("proi")} (inverted for progress view)`,
      rawLabel: "PROI",
      valuesByRunId: proi,
    },
    {
      metric: "avg_percent_correct",
      color: SERIES_COLORS.avg_percent_correct,
      label: rehabMetricDisplayName("avg_percent_correct"),
      rawLabel: "Avg % Correct",
      valuesByRunId: avg,
    },
  ];
}

function getCategorySeries(runs: RehabRunRecord[], categories: RehabCategoryRecord[], targetKey: string): SeriesDefinition[] {
  const roi = new Map<string, SeriesPoint>();
  const proi = new Map<string, SeriesPoint>();
  const avg = new Map<string, SeriesPoint>();

  for (const category of categories) {
    const key = `${category.categoryType}::${category.categoryName}`;
    if (key !== targetKey) {
      continue;
    }
    if (category.hasRoi && typeof category.roi === "number" && Number.isFinite(category.roi)) {
      roi.set(category.runId, {
        runId: category.runId,
        snapshotAt: "",
        rawValue: category.roi,
        progressValue: toRehabProgressValue("roi", category.roi),
      });
    }
    if (category.hasProi && typeof category.proi === "number" && Number.isFinite(category.proi)) {
      proi.set(category.runId, {
        runId: category.runId,
        snapshotAt: "",
        rawValue: category.proi,
        progressValue: toRehabProgressValue("proi", category.proi),
      });
    }
    if (
      typeof category.avgPercentCorrect === "number" &&
      Number.isFinite(category.avgPercentCorrect) &&
      (category.attemptedCount ?? 0) > 0
    ) {
      avg.set(category.runId, {
        runId: category.runId,
        snapshotAt: "",
        rawValue: category.avgPercentCorrect,
        progressValue: toRehabProgressValue("avg_percent_correct", category.avgPercentCorrect),
      });
    }
  }

  for (const run of runs) {
    const snapshotAt = run.snapshotAt;
    const roiPoint = roi.get(run.id);
    if (roiPoint) roi.set(run.id, { ...roiPoint, snapshotAt });
    const proiPoint = proi.get(run.id);
    if (proiPoint) proi.set(run.id, { ...proiPoint, snapshotAt });
    const avgPoint = avg.get(run.id);
    if (avgPoint) avg.set(run.id, { ...avgPoint, snapshotAt });
  }

  return [
    {
      metric: "roi",
      color: SERIES_COLORS.roi,
      label: `${rehabMetricDisplayName("roi")} (inverted for progress view)`,
      rawLabel: "ROI",
      valuesByRunId: roi,
    },
    {
      metric: "proi",
      color: SERIES_COLORS.proi,
      label: `${rehabMetricDisplayName("proi")} (inverted for progress view)`,
      rawLabel: "PROI",
      valuesByRunId: proi,
    },
    {
      metric: "avg_percent_correct",
      color: SERIES_COLORS.avg_percent_correct,
      label: rehabMetricDisplayName("avg_percent_correct"),
      rawLabel: "Avg % Correct",
      valuesByRunId: avg,
    },
  ];
}

export function RehabPanel({ examMode, refreshVersion = 0 }: RehabPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [data, setData] = useState<RehabSnapshotsResponse | null>(null);
  const [target, setTarget] = useState<TrendTarget>("overall");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError("");
      setInfoMessage("");
      try {
        const response = await fetch(`/api/rehab/snapshots?examMode=${encodeURIComponent(examMode)}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const json = (await response.json()) as RehabSnapshotsResponse;
        if (!response.ok) {
          const message =
            typeof json?.message === "string" && json.message.trim()
              ? json.message
              : "Unable to load Rehab snapshots right now.";
          throw new Error(message);
        }
        if (!active) {
          return;
        }
        const nextData: RehabSnapshotsResponse = {
          runs: Array.isArray(json.runs) ? json.runs : [],
          categories: Array.isArray(json.categories) ? json.categories : [],
          setupRequired: json.setupRequired === true,
          message: typeof json.message === "string" ? json.message : undefined,
        };
        setData(nextData);
        if (nextData.setupRequired) {
          setInfoMessage(
            `${nextData.message ?? "Rehab database setup is incomplete."} Apply \`supabase/migrations/20260223_rehab_snapshots.sql\` and reload.`,
          );
        }
      } catch (loadError) {
        if (!active || (loadError instanceof DOMException && loadError.name === "AbortError")) {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Unable to load Rehab snapshots right now.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
    };
  }, [examMode, refreshVersion]);

  const runs = data?.runs ?? [];
  const categories = data?.categories ?? [];

  const categoryOptions = useMemo<CategoryOption[]>(() => {
    const seen = new Set<string>();
    const options: CategoryOption[] = [];
    for (const category of categories) {
      const key = `${category.categoryType}::${category.categoryName}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      options.push({
        key,
        categoryName: category.categoryName,
        categoryType: category.categoryType,
        label: `${category.categoryName} (${CATEGORY_LABEL_BY_TYPE[category.categoryType]})`,
      });
    }

    options.sort((a, b) => {
      const typeCompare = CATEGORY_LABEL_BY_TYPE[a.categoryType].localeCompare(CATEGORY_LABEL_BY_TYPE[b.categoryType]);
      if (typeCompare !== 0) return typeCompare;
      return a.categoryName.localeCompare(b.categoryName);
    });
    return options;
  }, [categories]);

  useEffect(() => {
    if (target === "overall") {
      return;
    }
    if (!categoryOptions.some((option) => option.key === target)) {
      setTarget("overall");
    }
  }, [categoryOptions, target]);

  const activeSeries = useMemo(() => {
    return target === "overall" ? getOverallSeries(runs) : getCategorySeries(runs, categories, target);
  }, [categories, runs, target]);

  const visibleSeries = useMemo(
    () =>
      activeSeries.filter((series) =>
        runs.some((run) => {
          const point = series.valuesByRunId.get(run.id);
          return Boolean(point && Number.isFinite(point.progressValue));
        }),
      ),
    [activeSeries, runs],
  );

  const selectedCategory = target === "overall" ? null : categoryOptions.find((option) => option.key === target) ?? null;

  const chartModel = useMemo(() => {
    if (runs.length === 0 || visibleSeries.length === 0) {
      return null;
    }

    const width = 760;
    const height = 280;
    const pad = { top: 16, right: 16, bottom: 44, left: 52 };
    const plotWidth = width - pad.left - pad.right;
    const plotHeight = height - pad.top - pad.bottom;

    const xForIndex = (index: number) => {
      if (runs.length <= 1) {
        return pad.left + plotWidth / 2;
      }
      return pad.left + (index / (runs.length - 1)) * plotWidth;
    };
    const yForPercent = (value: number) => pad.top + ((100 - value) / 100) * plotHeight;
    const gridValues = [100, 66.67, 33.33, 0];

    const lineSeries = visibleSeries.map((series) => {
      const seriesProgressValues = runs
        .map((run) => series.valuesByRunId.get(run.id)?.progressValue)
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
      const seriesMin = seriesProgressValues.length > 0 ? Math.min(...seriesProgressValues) : 0;
      const seriesMax = seriesProgressValues.length > 0 ? Math.max(...seriesProgressValues) : 1;
      const normalizeSeriesValue = (value: number) => {
        if (seriesMax === seriesMin) {
          return 50;
        }
        return ((value - seriesMin) / (seriesMax - seriesMin)) * 100;
      };

      const segments: Array<{ path: string; points: Array<{ x: number; y: number; point: SeriesPoint; label: string }> }> = [];
      let current: Array<{ x: number; y: number; point: SeriesPoint; label: string }> = [];

      for (let index = 0; index < runs.length; index += 1) {
        const run = runs[index];
        const point = series.valuesByRunId.get(run.id);
        if (!point) {
          if (current.length > 0) {
            segments.push({ path: buildLinePath(current.map((item) => ({ x: item.x, y: item.y }))), points: current });
            current = [];
          }
          continue;
        }

        current.push({
          x: xForIndex(index),
          y: yForPercent(normalizeSeriesValue(point.progressValue)),
          point: { ...point, snapshotAt: run.snapshotAt },
          label: run.label ?? "",
        });
      }

      if (current.length > 0) {
        segments.push({ path: buildLinePath(current.map((item) => ({ x: item.x, y: item.y }))), points: current });
      }

      return { ...series, segments };
    });

    const xTicks = runs.map((run, index) => ({
      x: xForIndex(index),
      label: formatDateLabel(run.snapshotAt),
      title: formatDateTimeLabel(run.snapshotAt),
      show: runs.length <= 8 || index === 0 || index === runs.length - 1 || index % Math.ceil(runs.length / 6) === 0,
    }));

    return {
      width,
      height,
      pad,
      gridValues,
      xTicks,
      lineSeries,
      yForPercent,
    };
  }, [runs, visibleSeries]);

  const latestMetricSummaries = useMemo(() => {
    return visibleSeries.map((series) => {
      const latestRunWithPoint = [...runs].reverse().find((run) => series.valuesByRunId.has(run.id));
      if (!latestRunWithPoint) {
        return null;
      }
      const point = series.valuesByRunId.get(latestRunWithPoint.id);
      if (!point) {
        return null;
      }
      return {
        metric: series.metric,
        color: series.color,
        label: series.label,
        rawLabel: series.rawLabel,
        rawValue: point.rawValue,
        snapshotAt: latestRunWithPoint.snapshotAt,
      };
    }).filter((item): item is NonNullable<typeof item> => item != null);
  }, [runs, visibleSeries]);

  return (
    <Card
      title="Rehab"
      description={`Progress tracking for ${getTestLabel(examMode)} snapshots. Rehab plots improvement over time so you can see whether your Achilles heel is shrinking.`}
      className="print-hide"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <label htmlFor="rehab-target" className="text-xs font-semibold uppercase tracking-wide text-stone-600">
              Trend Scope
            </label>
            <select
              id="rehab-target"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              className="min-w-[18rem] rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              <option value="overall">Overall (all categories combined)</option>
              {categoryOptions.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="text-xs text-stone-600">
            <p>ROI/PROI are inverted in this chart so higher = improving.</p>
            <p>Chart lines use a normalized progress scale for readability; summaries/tooltips show raw values.</p>
            <p>Raw ROI/PROI values remain unchanged elsewhere in Achilles Insight.</p>
          </div>
        </div>

        {loading ? <Alert variant="info">Loading Rehab snapshots...</Alert> : null}
        {!loading && infoMessage ? <Alert variant="info">{infoMessage}</Alert> : null}
        {error ? <Alert>{error}</Alert> : null}

        {!loading && !error && runs.length === 0 ? (
          <Alert variant="info">
            No Rehab snapshots yet. Generate a results page from an upload to create your first snapshot automatically.
          </Alert>
        ) : null}

        {!loading && !error && runs.length > 0 ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-stone-200 bg-stone-50/40 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold text-stone-900">
                  {selectedCategory ? `Category Trend: ${selectedCategory.label}` : "Overall Trend"}
                </span>
                <span className="rounded border border-stone-300 px-2 py-0.5 text-xs text-stone-600">
                  {runs.length} snapshot{runs.length === 1 ? "" : "s"}
                </span>
              </div>

              {visibleSeries.length === 0 ? (
                <Alert variant="info">
                  No trendable metrics are available for this selection yet. Try a category with QBank and/or score report data.
                </Alert>
              ) : chartModel ? (
                <div className="space-y-3">
                  <div className="overflow-x-auto">
                    <svg
                      viewBox={`0 0 ${chartModel.width} ${chartModel.height}`}
                      className="h-auto min-w-[640px] w-full rounded-md bg-white"
                      role="img"
                      aria-label="Rehab progress trend chart"
                    >
                      <rect x="0" y="0" width={chartModel.width} height={chartModel.height} fill="white" rx="8" />
                      {chartModel.gridValues.map((value) => (
                        <g key={`rehab-grid-${value.toFixed(5)}`}>
                          <line
                            x1={chartModel.pad.left}
                            x2={chartModel.width - chartModel.pad.right}
                            y1={chartModel.yForPercent(value)}
                            y2={chartModel.yForPercent(value)}
                            stroke="#e7e5e4"
                            strokeWidth="1"
                          />
                          <text
                            x={chartModel.pad.left - 8}
                            y={chartModel.yForPercent(value) + 4}
                            textAnchor="end"
                            fontSize="11"
                            fill="#78716c"
                          >
                            {`${Math.round(value)}%`}
                          </text>
                        </g>
                      ))}

                      <line
                        x1={chartModel.pad.left}
                        x2={chartModel.width - chartModel.pad.right}
                        y1={chartModel.height - chartModel.pad.bottom}
                        y2={chartModel.height - chartModel.pad.bottom}
                        stroke="#d6d3d1"
                        strokeWidth="1"
                      />

                      {chartModel.xTicks.map((tick, index) => (
                        <g key={`rehab-x-${index}`}>
                          <line
                            x1={tick.x}
                            x2={tick.x}
                            y1={chartModel.height - chartModel.pad.bottom}
                            y2={chartModel.height - chartModel.pad.bottom + 5}
                            stroke="#d6d3d1"
                            strokeWidth="1"
                          />
                          {tick.show ? (
                            <text
                              x={tick.x}
                              y={chartModel.height - chartModel.pad.bottom + 18}
                              textAnchor="middle"
                              fontSize="11"
                              fill="#78716c"
                            >
                              {tick.label}
                              <title>{tick.title}</title>
                            </text>
                          ) : null}
                        </g>
                      ))}

                      {chartModel.lineSeries.map((series) => (
                        <g key={`rehab-series-${series.metric}`}>
                          {series.segments.map((segment, segmentIndex) => (
                            <path
                              key={`rehab-segment-${series.metric}-${segmentIndex}`}
                              d={segment.path}
                              fill="none"
                              stroke={series.color}
                              strokeWidth="2.5"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                            />
                          ))}
                          {series.segments.flatMap((segment) => segment.points).map((dot, dotIndex) => (
                            <circle
                              key={`rehab-dot-${series.metric}-${dotIndex}-${dot.point.runId}`}
                              cx={dot.x}
                              cy={dot.y}
                              r="4"
                              fill={series.color}
                              stroke="white"
                              strokeWidth="1.5"
                            >
                              <title>
                                {`${series.rawLabel}: ${formatMetricRaw(series.metric, dot.point.rawValue)}\n${formatDateTimeLabel(dot.point.snapshotAt)}${dot.label ? `\n${dot.label}` : ""}`}
                              </title>
                            </circle>
                          ))}
                        </g>
                      ))}
                    </svg>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    {latestMetricSummaries.map((summary) => (
                      <div key={`rehab-summary-${summary.metric}`} className="rounded-md border border-stone-200 bg-white p-3 text-sm">
                        <div className="mb-1 flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: summary.color }} />
                          <p className="font-semibold text-stone-900">{summary.label}</p>
                        </div>
                        <p className="text-stone-700">
                          Latest raw {summary.rawLabel}: <span className="font-semibold">{formatMetricRaw(summary.metric, summary.rawValue)}</span>
                        </p>
                        <p className="text-xs text-stone-500">{formatDateTimeLabel(summary.snapshotAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <Alert variant="info">Not enough data to draw a chart yet.</Alert>
              )}
            </div>

            <div className="rounded-lg border border-dashed border-stone-300 bg-white/80 p-4 text-sm text-stone-700">
              <p className="font-semibold text-stone-900">Top improvers / regressions (coming next)</p>
              <p className="mt-1">
                Snapshot data is now being stored per run and per canonical category, so this panel can rank biggest improvements
                and regressions in a follow-up iteration.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </Card>
  );
}
