"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { clearUploadSession, getUploadSession } from "../lib/session";
import type { ParsedRow } from "../lib/types";

type RankingMode = "roi" | "weakness";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function sortRows(rows: ParsedRow[], rankingMode: RankingMode) {
  return [...rows].sort((a, b) => {
    if (rankingMode === "roi") {
      const byRoi = b.roi - a.roi;
      if (byRoi !== 0) {
        return byRoi;
      }
      return a.name.localeCompare(b.name);
    }

    const byWeakness = a.accuracy - b.accuracy;
    if (byWeakness !== 0) {
      return byWeakness;
    }
    return a.name.localeCompare(b.name);
  });
}

function filterByCategory(rows: ParsedRow[], categoryType: ParsedRow["categoryType"]) {
  return rows.filter((row) => row.categoryType === categoryType);
}

function getPriorityReason(rankingMode: RankingMode) {
  return rankingMode === "roi"
    ? "High impact because weight is high and accuracy is low."
    : "Lowest accuracy area.";
}

function buildTimeSplit(rows: ParsedRow[], rankingMode: RankingMode): Array<{ name: string; percentage: number }> {
  const topRows = rows.slice(0, 3);
  if (topRows.length === 0) {
    return [];
  }

  const rawValues = topRows.map((row) => (rankingMode === "roi" ? row.roi : 1 - row.accuracy));
  const safeValues = rawValues.map((value) => (value > 0 ? value : 0));
  const total = safeValues.reduce((sum, value) => sum + value, 0);

  if (total <= 0) {
    const equalSplit = Math.floor(100 / topRows.length);
    const remainder = 100 - equalSplit * topRows.length;
    return topRows.map((row, index) => ({
      name: row.name,
      percentage: equalSplit + (index < remainder ? 1 : 0),
    }));
  }

  const rounded = safeValues.map((value) => Math.round((value / total) * 100));
  const roundedTotal = rounded.reduce((sum, value) => sum + value, 0);
  const delta = 100 - roundedTotal;
  if (delta !== 0) {
    rounded[0] += delta;
  }

  return topRows.map((row, index) => ({
    name: row.name,
    percentage: rounded[index],
  }));
}

function RankTable({ title, rows }: { title: string; rows: ParsedRow[] }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="text-sm text-stone-600">No rows available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-stone-700">
              <tr className="border-b border-stone-200">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Correct/Total</th>
                <th className="px-2 py-2">Accuracy</th>
                <th className="px-2 py-2">Weight</th>
                <th className="px-2 py-2">ROI</th>
              </tr>
            </thead>
            <tbody className="text-stone-800">
              {rows.map((row) => (
                <tr className="border-b border-stone-100" key={`${row.categoryType}-${row.name}`}>
                  <td className="px-2 py-2">{row.name}</td>
                  <td className="px-2 py-2">
                    {row.correct}/{row.total}
                  </td>
                  <td className="px-2 py-2">{formatPercent(row.accuracy)}</td>
                  <td className="px-2 py-2">{formatPercent(row.weight)}</td>
                  <td className="px-2 py-2">{row.roi.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const uploadData = getUploadSession();
  const [rankingMode, setRankingMode] = useState<RankingMode>("roi");

  const rankedRows = useMemo(() => {
    if (!uploadData) {
      return null;
    }

    return {
      allRows: sortRows(uploadData.parsedRows, rankingMode),
      competencyRows: sortRows(filterByCategory(uploadData.parsedRows, "competency_domain"), rankingMode),
      clinicalRows: sortRows(filterByCategory(uploadData.parsedRows, "clinical_presentation"), rankingMode),
      disciplineRows: sortRows(filterByCategory(uploadData.parsedRows, "discipline"), rankingMode),
    };
  }, [uploadData, rankingMode]);

  const topPriorities = rankedRows?.allRows.slice(0, 5) ?? [];
  const timeSplitRows = rankedRows ? buildTimeSplit(rankedRows.allRows, rankingMode) : [];

  if (!uploadData || !rankedRows) {
    return (
      <section className="space-y-8 pt-6 sm:pt-10">
        <BrandHeader subtitle="Find and rank your highest-impact weak points." />
        <Card title="Results">
          <p className="text-stone-700">No parsed CSV found for this session.</p>
          <Link
            href="/upload"
            className="inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
          >
            Go to Upload
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6 pt-6 sm:pt-10">
      <BrandHeader subtitle="Find and rank your highest-impact weak points." />

      <section className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
        <h2 className="text-2xl font-semibold tracking-tight text-stone-900">Results</h2>

        <div className="justify-self-center">
          <div className="inline-flex items-center gap-2 rounded-md border border-stone-300 bg-white p-1">
            <button
              type="button"
              onClick={() => {
                setRankingMode("roi");
              }}
              className={`rounded-md px-3 py-2 text-sm ${
                rankingMode === "roi" ? "bg-stone-800 text-amber-50" : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              Rank by ROI
            </button>
            <button
              type="button"
              onClick={() => {
                setRankingMode("weakness");
              }}
              className={`rounded-md px-3 py-2 text-sm ${
                rankingMode === "weakness" ? "bg-stone-800 text-amber-50" : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              Rank by Weakness %
            </button>
          </div>
        </div>

        <div />
      </section>

      <Card title="ROI definition">
        <p className="text-sm text-stone-700">
          ROI = (1 - accuracy) x weight. Higher ROI means fixing that area is more likely to improve your score.
        </p>
      </Card>

      <RankTable title="General combined list" rows={rankedRows.allRows} />
      <RankTable title="Competency domain rank list" rows={rankedRows.competencyRows} />
      <RankTable title="Clinical presentation rank list" rows={rankedRows.clinicalRows} />
      <RankTable title="Discipline rank list" rows={rankedRows.disciplineRows} />

      <Card title="Top priorities">
        {topPriorities.length === 0 ? (
          <p className="text-sm text-stone-600">No ranked rows available.</p>
        ) : (
          <ul className="space-y-3">
            {topPriorities.map((row) => (
              <li key={`priority-${row.categoryType}-${row.name}`} className="rounded-md border border-stone-200 p-3">
                <p className="text-sm font-semibold text-stone-900">{row.name}</p>
                <p className="mt-1 text-sm text-stone-700">
                  Accuracy {formatPercent(row.accuracy)} | Weight {formatPercent(row.weight)}
                  {rankingMode === "roi" ? ` | ROI ${row.roi.toFixed(4)}` : ""}
                </p>
                <p className="mt-1 text-xs text-stone-600">{getPriorityReason(rankingMode)}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Recommended time split">
        {timeSplitRows.length === 0 ? (
          <p className="text-sm text-stone-600">No split available.</p>
        ) : (
          <div className="space-y-1 text-sm text-stone-800">
            {timeSplitRows.map((item) => (
              <p key={`time-split-${item.name}`}>
                {item.name} - {item.percentage}%
              </p>
            ))}
          </div>
        )}
        <p className="text-xs text-stone-600">This is a heuristic; adjust based on your timeline.</p>
      </Card>

      <button
        type="button"
        onClick={() => {
          clearUploadSession();
          router.push("/upload");
        }}
        className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
      >
        Start over
      </button>
    </section>
  );
}
