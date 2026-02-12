"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearUploadSession, getUploadSession } from "../lib/session";
import type { ParsedRow } from "../lib/types";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function sortWorstToBest(rows: ParsedRow[]) {
  return [...rows].sort((a, b) => b.roi - a.roi);
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
                  <td className="px-2 py-2">{row.correct}/{row.total}</td>
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

  if (!uploadData) {
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

  const allRows = sortWorstToBest(uploadData.parsedRows);
  const competencyRows = sortWorstToBest(filterByCategory(uploadData.parsedRows, "competency_domain"));
  const clinicalRows = sortWorstToBest(filterByCategory(uploadData.parsedRows, "clinical_presentation"));
  const disciplineRows = sortWorstToBest(filterByCategory(uploadData.parsedRows, "discipline"));

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-sm text-slate-600">Rows are ranked worst to best by ROI.</p>
      </header>

      <RankTable title="A) General Combined Rank List" rows={allRows} />
      <RankTable title="B) Competency Domains Rank List" rows={competencyRows} />
      <RankTable title="C) Clinical Presentations Rank List" rows={clinicalRows} />
      <RankTable title="D) Discipline Rank List" rows={disciplineRows} />
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