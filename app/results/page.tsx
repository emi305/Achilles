"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

function RankTable({ title, rows }: { title: string; rows: ParsedRow[] }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-600">No rows available.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-slate-700">
              <tr className="border-b border-slate-200">
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Correct/Total</th>
                <th className="px-2 py-2">Accuracy</th>
                <th className="px-2 py-2">Weight</th>
                <th className="px-2 py-2">ROI</th>
              </tr>
            </thead>
            <tbody className="text-slate-800">
              {rows.map((row) => (
                <tr className="border-b border-slate-100" key={`${row.categoryType}-${row.name}`}>
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
    </section>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const uploadData = getUploadSession();
  const [rankingMode, setRankingMode] = useState<RankingMode>("roi");

  const modeLabel = rankingMode === "roi" ? "Ranking mode: ROI impact" : "Ranking mode: Weakness %";

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

  if (!uploadData || !rankedRows) {
    return (
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-slate-700">No parsed CSV found for this session.</p>
        <Link
          href="/upload"
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Go to Upload
        </Link>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-sm text-slate-600">{modeLabel}</p>
      </header>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-900">Sort ranking by</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRankingMode("roi");
            }}
            className={`rounded-md px-3 py-2 text-sm ${
              rankingMode === "roi" ? "bg-slate-900 text-white" : "border border-slate-300 bg-white text-slate-700"
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
              rankingMode === "weakness"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700"
            }`}
          >
            Rank by Weakness %
          </button>
        </div>
      </section>

      <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">What is ROI?</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>"Accuracy" = correct/total for that category.</li>
          <li>"Weight" = how much that category counts on COMLEX Level 2 (as a %).</li>
          <li>"ROI = (1 − accuracy) × weight"</li>
          <li>Higher ROI means: improving this area is more likely to raise your score.</li>
          <li>
            Weakness % mode answers: “What am I worst at?” ROI mode answers: “What should I fix first to gain the
            most points?”
          </li>
        </ul>
      </section>

      <RankTable title="A) General Combined Rank List" rows={rankedRows.allRows} />
      <RankTable title="B) Competency Domains Rank List" rows={rankedRows.competencyRows} />
      <RankTable title="C) Clinical Presentations Rank List" rows={rankedRows.clinicalRows} />
      <RankTable title="D) Discipline Rank List" rows={rankedRows.disciplineRows} />
      <RankTable title="Raw Parsed Table (Debug)" rows={uploadData.parsedRows} />

      <button
        type="button"
        onClick={() => {
          clearUploadSession();
          router.push("/upload");
        }}
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Start over
      </button>
    </section>
  );
}