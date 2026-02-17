"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../components/Alert";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { CATEGORY_LABEL_BY_TYPE, getCategoryOrderForTest } from "../lib/blueprint";
import {
  clearUploadSession,
  getClientParsedRows,
  getUploadSession,
  getServerParsedRows,
  subscribeUploadSession,
} from "../lib/session";
import { DEFAULT_TEST_TYPE, getTestLabel } from "../lib/testSelection";
import { USMLE_STEP2_SUBJECT_WEIGHTS, USMLE_STEP2_SYSTEM_WEIGHTS } from "../lib/usmleStep2Weights";
import type { CategoryType, ParsedRow, TestType, ZeusContext, ZeusContextRow } from "../lib/types";
import { getProiScore, getRoiScore, type RankingMode } from "../lib/priority";

type DisplayRow = {
  categoryType: CategoryType;
  name: string;
  weight: number;
  roi: number;
  proi: number;
  hasRoi: boolean;
  hasProi: boolean;
  avgCorrect?: number;
  weaknessForSort: number;
  focusScore: number;
};

type TableSection = {
  key: "general" | CategoryType;
  title: string;
  rows: DisplayRow[];
};

type AccumulatorRow = {
  categoryType: CategoryType;
  name: string;
  weight: number;
  roi: number;
  proi: number;
  hasRoi: boolean;
  hasProi: boolean;
  qbankCorrectSum: number;
  qbankTotalSum: number;
  qbankAccuracySum: number;
  qbankAccuracyCount: number;
};

type UnmappedRowGroup = {
  originalName: string;
  categoryType: CategoryType;
  source: string;
  count: number;
  examples: string[];
};

type Big3Metric = "roi" | "proi";

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

function formatScore(value: number) {
  return value.toFixed(3);
}

function isUworldTaxonomyRow(row: ParsedRow | DisplayRow) {
  return row.categoryType === "uworld_subject" || row.categoryType === "uworld_system";
}

function buildBig3Data(rows: DisplayRow[], metric: Big3Metric) {
  const subjectType: CategoryType = metric === "roi" ? "uworld_subject" : "discipline";
  const systemType: CategoryType = metric === "roi" ? "uworld_system" : "system";
  const metricRows = rows.filter((row) =>
    metric === "roi"
      ? row.categoryType === subjectType || row.categoryType === systemType
      : (row.categoryType === subjectType || row.categoryType === systemType) && row.hasProi,
  );

  const medicineRow =
    metricRows.find((row) => row.categoryType === subjectType && row.name === "Medicine (IM)") ??
    metricRows.find((row) => row.categoryType === subjectType);
  const topSystems = metricRows
    .filter((row) => row.categoryType === systemType)
    .sort((a, b) => {
      const aMetric = metric === "roi" ? a.roi : a.proi;
      const bMetric = metric === "roi" ? b.roi : b.proi;
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

  for (const [name, weight] of Object.entries(USMLE_STEP2_SUBJECT_WEIGHTS)) {
    const key = `uworld_subject::${name}`;
    if (byKey.has(key)) {
      continue;
    }
    filled.push({
      categoryType: "uworld_subject",
      name,
      weight,
      roi: 0,
      proi: 0,
      hasRoi: true,
      hasProi: false,
      avgCorrect: undefined,
      weaknessForSort: 0,
      focusScore: 0,
    });
  }

  for (const [name, weight] of Object.entries(USMLE_STEP2_SYSTEM_WEIGHTS)) {
    const key = `uworld_system::${name}`;
    if (byKey.has(key)) {
      continue;
    }
    filled.push({
      categoryType: "uworld_system",
      name,
      weight,
      roi: 0,
      proi: 0,
      hasRoi: true,
      hasProi: false,
      avgCorrect: undefined,
      weaknessForSort: 0,
      focusScore: 0,
    });
  }

  return filled;
}

function sortDisplayRows(rows: DisplayRow[], mode: RankingMode): DisplayRow[] {
  return [...rows].sort((a, b) => {
    if (mode === "avg") {
      const aAvg = typeof a.avgCorrect === "number" ? a.avgCorrect : Number.POSITIVE_INFINITY;
      const bAvg = typeof b.avgCorrect === "number" ? b.avgCorrect : Number.POSITIVE_INFINITY;
      if (aAvg !== bAvg) {
        return aAvg - bAvg;
      }
      if (b.weight !== a.weight) {
        return b.weight - a.weight;
      }
      return a.name.localeCompare(b.name);
    }

    if (b.roi !== a.roi) {
      return b.roi - a.roi;
    }
    if (b.weight !== a.weight) {
      return b.weight - a.weight;
    }
    return a.name.localeCompare(b.name);
  });
}

function sortByFocusScore(rows: DisplayRow[]): DisplayRow[] {
  return [...rows].sort((a, b) => {
    if (b.focusScore !== a.focusScore) {
      return b.focusScore - a.focusScore;
    }
    if (b.proi !== a.proi) {
      return b.proi - a.proi;
    }
    if (b.roi !== a.roi) {
      return b.roi - a.roi;
    }
    if (b.weaknessForSort !== a.weaknessForSort) {
      return b.weaknessForSort - a.weaknessForSort;
    }
    return a.name.localeCompare(b.name);
  });
}

function finalizeAccumulator(value: AccumulatorRow): DisplayRow {
  let avgCorrect: number | undefined;

  if (value.qbankTotalSum > 0) {
    avgCorrect = clamp01(value.qbankCorrectSum / value.qbankTotalSum);
  } else if (value.qbankAccuracyCount > 0) {
    avgCorrect = clamp01(value.qbankAccuracySum / value.qbankAccuracyCount);
  }

  const weaknessForSort = typeof avgCorrect === "number" ? clamp01(1 - avgCorrect) : 0;
  const weaknessWeighted = weaknessForSort * value.weight;
  const focusScore = value.roi + value.proi + weaknessWeighted;

  return {
    categoryType: value.categoryType,
    name: value.name,
    weight: value.weight,
    roi: value.roi,
    proi: value.proi,
    hasRoi: value.hasRoi,
    hasProi: value.hasProi,
    avgCorrect,
    weaknessForSort,
    focusScore,
  };
}

function aggregateRows(rows: ParsedRow[]): DisplayRow[] {
  const byKey = new Map<string, AccumulatorRow>();

  for (const row of rows) {
    if (row.unmapped || row.weight == null) {
      continue;
    }
    const key = `${row.categoryType}::${row.name}`;
    const roi = getRoiScore(row);
    const hasProi = typeof row.proxyWeakness === "number" || typeof row.proi === "number";
    const proi =
      typeof row.proxyWeakness === "number"
        ? row.proxyWeakness * row.weight
        : hasProi
          ? getProiScore(row)
          : 0;
    const hasQbankAccuracy = typeof row.accuracy === "number";

    const existing = byKey.get(key);
    if (!existing) {
      const created: AccumulatorRow = {
        categoryType: row.categoryType,
        name: row.name,
        weight: row.weight,
        roi,
        proi,
        hasRoi: hasQbankAccuracy || roi > 0,
        hasProi,
        qbankCorrectSum: 0,
        qbankTotalSum: 0,
        qbankAccuracySum: 0,
        qbankAccuracyCount: 0,
      };

      if (typeof row.correct === "number" && typeof row.total === "number" && row.total > 0) {
        created.qbankCorrectSum += row.correct;
        created.qbankTotalSum += row.total;
      } else if (typeof row.accuracy === "number") {
        created.qbankAccuracySum += clamp01(row.accuracy);
        created.qbankAccuracyCount += 1;
      }

      byKey.set(key, created);
      continue;
    }

    existing.weight = Math.max(existing.weight, row.weight);
    existing.roi += roi;
    existing.proi += proi;
    existing.hasRoi = existing.hasRoi || hasQbankAccuracy || roi > 0;
    existing.hasProi = existing.hasProi || hasProi;

    if (typeof row.correct === "number" && typeof row.total === "number" && row.total > 0) {
      existing.qbankCorrectSum += row.correct;
      existing.qbankTotalSum += row.total;
    } else if (typeof row.accuracy === "number") {
      existing.qbankAccuracySum += clamp01(row.accuracy);
      existing.qbankAccuracyCount += 1;
    }
  }

  return Array.from(byKey.values()).map(finalizeAccumulator);
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
  bullets.push(`Makes up ${formatPercent(row.weight)} of the test.`);

  const hasQbank = row.hasRoi || typeof row.avgCorrect === "number";
  const hasScoreReportSignal = hasScoreReport && row.hasProi;

  if (!hasQbank && !hasScoreReportSignal) {
    bullets.push("Not enough data yet—add QBank or a score report to prioritize this accurately.");
    return bullets;
  }

  const roiRank = ranks.roiRank;
  const avgRank = ranks.avgRank;
  const proiRank = ranks.proiRank;
  const roiDriverScore = row.hasRoi && roiRank > 0 ? 1 / roiRank : 0;
  const avgDriverScore = typeof avgRank === "number" && avgRank > 0 ? 1 / avgRank : 0;
  const proiDriverScore = hasScoreReportSignal && typeof proiRank === "number" && proiRank > 0 ? 1 / proiRank : 0;
  const maxDriverScore = Math.max(roiDriverScore, avgDriverScore, proiDriverScore);

  if (row.hasRoi) {
    let roiMeaning = "improvements here should pay off quickly.";
    if (roiRank <= 3) {
      roiMeaning = "this is a highest-impact ROI signal and likely one of your fastest returns per study hour.";
    } else if (roiRank <= 5) {
      roiMeaning = "this is a high ROI signal with strong expected return.";
    } else if (maxDriverScore === roiDriverScore) {
      roiMeaning = "ROI is the main driver here, so focused question reps should produce measurable gains.";
    }
    bullets.push(`ROI rank #${roiRank} (value ${formatScore(row.roi)}): ${roiMeaning}`);
  }

  if (typeof row.avgCorrect === "number" && typeof avgRank === "number") {
    let avgMeaning = "this is lower than most categories, so it's a likely point gain.";
    if (avgRank <= 5) {
      avgMeaning = "this is one of your lowest averages and needs urgent review.";
    } else if (maxDriverScore === avgDriverScore) {
      avgMeaning = "lowest average is the main reason this moved up your priority list.";
    }
    bullets.push(`Avg % Correct rank #${avgRank} at ${formatPercent(row.avgCorrect)}: ${avgMeaning}`);
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
    if (row.weight >= 0.15) {
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
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-3 py-2">Name</th>
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
                <td className="px-3 py-2 text-stone-700">{formatPercent(row.weight)}</td>
                {mode === "roi" ? (
                  <>
                    <td className="px-3 py-2 text-stone-700">{row.hasRoi ? formatScore(row.roi) : "-"}</td>
                    {showProiColumn ? (
                      <td className="px-3 py-2 text-stone-700">
                        {row.hasProi ? formatScore(row.proi) : PROI_PLACEHOLDER}
                      </td>
                    ) : null}
                  </>
                ) : (
                  <td className="px-3 py-2 text-stone-700">
                    {typeof row.avgCorrect === "number" ? formatPercent(row.avgCorrect) : "— (QBank data required)"}
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

export default function ResultsPage() {
  const router = useRouter();
  const [rankingMode, setRankingMode] = useState<RankingMode>("roi");
  const [showRestOfData, setShowRestOfData] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const parsedRows = useSyncExternalStore(subscribeUploadSession, getClientParsedRows, getServerParsedRows);
  const uploadSession = getUploadSession();
  const rawAggregated = useMemo(() => aggregateRows(parsedRows), [parsedRows]);
  const selectedTest = useMemo<TestType>(() => {
    const fromSession = getUploadSession()?.selectedTest;
    if (fromSession) {
      return fromSession;
    }
    const fromRows = parsedRows.find((row) => row.testType)?.testType;
    return fromRows ?? DEFAULT_TEST_TYPE;
  }, [parsedRows]);
  const aggregated = useMemo(() => withUsmleCanonicalCoverage(rawAggregated, selectedTest), [rawAggregated, selectedTest]);
  const categoryOrder = useMemo(() => getCategoryOrderForTest(selectedTest), [selectedTest]);

  const sections = useMemo<TableSection[]>(() => {
    const generalRows = sortDisplayRows(aggregated, rankingMode);
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

  const topFive = useMemo(() => sortByFocusScore(aggregated).slice(0, 5), [aggregated]);
  const big3Roi = useMemo(() => buildBig3Data(aggregated, "roi"), [aggregated]);
  const big3Proi = useMemo(() => buildBig3Data(aggregated, "proi"), [aggregated]);
  const hasUworldQbankRows = useMemo(
    () =>
      selectedTest === "usmle_step2" &&
      parsedRows.some((row) => row.inputSource === "uworld_qbank" || isUworldTaxonomyRow(row)),
    [parsedRows, selectedTest],
  );
  const hasScoreReport = useMemo(() => {
    const sessionFlag = uploadSession?.scoreReportProvided;
    if (typeof sessionFlag === "boolean") {
      return sessionFlag;
    }
    return parsedRows.some((row) => typeof row.proxyWeakness === "number");
  }, [parsedRows, uploadSession]);
  const showProiColumn = useMemo(() => hasScoreReport && aggregated.some((row) => row.hasProi), [aggregated, hasScoreReport]);
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
        weight: row.weight,
        roi: row.roi,
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
            : row[scoreKey],
      }));

    const roiOrdered = sortDisplayRows([...aggregated], "roi");
    const avgOrdered = sortDisplayRows([...aggregated], "avg");
    const proiOrdered = [...aggregated].filter((row) => row.hasProi).sort((a, b) => b.proi - a.proi);
    const combinedOrdered = sortByFocusScore([...aggregated]);

    return {
      exam: selectedTest,
      rows: zeusRows,
      topFive: topFive.map((row) => ({
        name: row.name,
        categoryType: row.categoryType,
        weight: row.weight,
        roi: row.roi,
        proi: row.hasProi ? row.proi : 0,
        avgCorrect: typeof row.avgCorrect === "number" ? row.avgCorrect : null,
      })),
      roiRanking: toRanked(roiOrdered, "roi"),
      avgCorrectRanking: toRanked(avgOrdered, "avgCorrect"),
      proiRanking: toRanked(proiOrdered, "proi"),
      combinedRanking: toRanked(combinedOrdered, "focusScore"),
    };
  }, [aggregated, selectedTest, topFive, zeusRows]);

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

  if (parsedRows.length === 0) {
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

  return (
    <section className="space-y-6 pt-6 sm:pt-10">
      <BrandHeader />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="brand-title text-2xl font-semibold text-stone-900">RESULTS: {getTestLabel(selectedTest)}</h2>
          <div className="flex flex-wrap items-center gap-2 md:justify-center">
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

      {mappingFailureRate > 0.05 ? (
        <Alert variant="error">
          {`Mapping failed — many categories could not be matched to the ${getTestLabel(selectedTest)} blueprint. This is a bug. Please re-upload or report.`}
        </Alert>
      ) : null}

      <Card title="Achilles Insight">
        <ul className="space-y-4 text-sm text-stone-800">
          {topFive.map((row) => (
            <li key={`insight-${row.categoryType}-${row.name}`} className="rounded-md border border-stone-200 bg-stone-50/40 p-3">
              <p className="font-semibold text-stone-900">
                {row.name} ({CATEGORY_LABEL_BY_TYPE[row.categoryType]})
              </p>
              <p>
                Weight: {formatPercent(row.weight)} | ROI: {row.hasRoi ? formatScore(row.roi) : "-"}
                {showProiColumn ? ` | PROI: ${row.hasProi ? formatScore(row.proi) : PROI_PLACEHOLDER}` : ""}
                {" | "}Avg % Correct: {typeof row.avgCorrect === "number" ? formatPercent(row.avgCorrect) : "Not available"}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="What to study?">
        <ul className="space-y-4 text-sm text-stone-800">
          {topFive.map((row) => (
            <li key={`study-${row.categoryType}-${row.name}`} className="rounded-md border border-stone-200 bg-stone-50/40 p-3">
              <p className="font-semibold text-stone-900">
                {row.name} ({CATEGORY_LABEL_BY_TYPE[row.categoryType]})
              </p>
              <ul className="list-disc pl-5">
                {buildWhatToStudyBullets(row, {
                  roiRank: roiRankMap.get(`${row.categoryType}::${row.name}`) ?? 0,
                  proiRank: proiRankMap.get(`${row.categoryType}::${row.name}`),
                  avgRank: avgRankMap.get(`${row.categoryType}::${row.name}`),
                }, hasScoreReport).map((bullet) => (
                  <li key={`${row.name}-study-${bullet}`}>{bullet}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Card>

      {selectedTest === "usmle_step2" ? (
        <Card>
          <div className="space-y-1 text-sm text-stone-700">
            {hasUworldQbankRows ? <p>QBank ROI (UWorld Subjects/Systems)</p> : null}
            {hasScoreReport ? <p>PROI (Score Report / NBME / Free120)</p> : null}
          </div>
        </Card>
      ) : null}

      {selectedTest === "usmle_step2" && (big3Roi.hasData || big3Proi.hasData) ? (
        <Card title="Big-3">
          <p className="text-sm text-stone-700">
            Big-3 = your highest-impact study targets right now. ROI uses QBank performance; PROI uses score-report
            weakness. Both already combine how weak you are and how heavily the exam weights that area.
          </p>

          {big3Roi.hasData ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Big-3 (QBank ROI)</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                  <p className="font-semibold text-stone-900">Medicine (IM)</p>
                  {big3Roi.medicineRow ? (
                    <p>
                      ROI: {formatScore(big3Roi.medicineRow.roi)} | Avg % Correct:{" "}
                      {typeof big3Roi.medicineRow.avgCorrect === "number"
                        ? formatPercent(big3Roi.medicineRow.avgCorrect)
                        : "Not available"}{" "}
                      | Weight: {formatPercent(big3Roi.medicineRow.weight)}
                    </p>
                  ) : (
                    <p>Not available</p>
                  )}
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                  <p className="font-semibold text-stone-900">Top 3 Systems</p>
                  <ul className="list-disc pl-5">
                    {big3Roi.topSystems.map((row) => (
                      <li key={`big3-roi-system-${row.name}`}>
                        {row.name} (ROI): {formatScore(row.roi)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                  <p className="font-semibold text-stone-900">Biostats + Social</p>
                  <p>Biostats ROI: {formatScore(big3Roi.biostatsRow?.roi ?? 0)}</p>
                  <p>Social Sciences ROI: {formatScore(big3Roi.socialRow?.roi ?? 0)}</p>
                </div>
              </div>
            </div>
          ) : null}

          {big3Proi.hasData ? (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-stone-900">Big-3 (Score Report PROI)</h3>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                  <p className="font-semibold text-stone-900">Medicine (IM)</p>
                  {big3Proi.medicineRow ? (
                    <p>
                      PROI: {formatScore(big3Proi.medicineRow.proi)} | Proxy Weakness:{" "}
                      {typeof big3Proi.medicineRow.proi === "number" && big3Proi.medicineRow.weight > 0
                        ? formatPercent(big3Proi.medicineRow.proi / big3Proi.medicineRow.weight)
                        : "Not available"}{" "}
                      | Weight: {formatPercent(big3Proi.medicineRow.weight)}
                    </p>
                  ) : (
                    <p>Not available</p>
                  )}
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                  <p className="font-semibold text-stone-900">Top 3 Systems</p>
                  <ul className="list-disc pl-5">
                    {big3Proi.topSystems.map((row) => (
                      <li key={`big3-proi-system-${row.name}`}>
                        {row.name} (PROI): {formatScore(row.proi)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-md border border-stone-200 bg-stone-50/40 p-3 text-sm text-stone-800">
                  <p className="font-semibold text-stone-900">Biostats + Social</p>
                  <p>Biostats PROI: {formatScore(big3Proi.biostatsRow?.proi ?? 0)}</p>
                  <p>Social Sciences PROI: {formatScore(big3Proi.socialRow?.proi ?? 0)}</p>
                </div>
              </div>
            </div>
          ) : null}
        </Card>
      ) : null}

      {unmappedGroups.length > 0 ? (
        <Card title="Unmapped Categories">
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

      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setShowRestOfData((prev) => !prev)}
          className="cursor-pointer rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
        >
          {showRestOfData ? "Hide rest of data" : "See rest of data"}
        </button>
      </div>

      <Card title="ZEUS" className="mx-auto w-full max-w-3xl">
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

      {showRestOfData
        ? sections.map((section) => (
            <RankTable
              key={section.key}
              title={section.title}
              rows={section.rows}
              mode={rankingMode}
              showProiColumn={showProiColumn}
            />
          ))
        : null}

      <div className="pt-2">
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
    </section>
  );
}

