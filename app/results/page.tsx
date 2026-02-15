"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import {
  clearUploadSession,
  getClientParsedRows,
  getServerParsedRows,
  subscribeUploadSession,
} from "../lib/session";
import type { CategoryType, ParsedRow } from "../lib/types";
import { getProiScore, getRoiScore, getWeaknessScore, sortRowsByMode, type RankingMode } from "../lib/priority";

type DisplayRow = {
  categoryType: CategoryType;
  name: string;
  weight: number;
  roi: number;
  proi: number;
  weakness: number;
  hasRoi: boolean;
  hasProi: boolean;
};

type TableSection = {
  key: "general" | CategoryType;
  title: string;
  rows: DisplayRow[];
};

const CATEGORY_ORDER: CategoryType[] = ["discipline", "competency_domain", "clinical_presentation"];

const CATEGORY_LABEL: Record<CategoryType, string> = {
  discipline: "Discipline",
  competency_domain: "Competency Domain",
  clinical_presentation: "Clinical Presentation",
};

const modeLabels: Record<RankingMode, string> = {
  roi: "Rank by ROI",
  weakness: "Rank by Weakness %",
};

const PROI_PLACEHOLDER = "Not available (upload score report)";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatPercent(value: number) {
  return `${round2(value * 100).toFixed(2)}%`;
}

function formatScore(value: number) {
  return round2(value).toFixed(3);
}

function aggregateRows(rows: ParsedRow[]): DisplayRow[] {
  const byKey = new Map<string, DisplayRow>();

  for (const row of rows) {
    const key = `${row.categoryType}::${row.name}`;
    const roi = getRoiScore(row);
    const proxyWeakness = typeof row.proxyWeakness === "number" ? row.proxyWeakness : undefined;
    const hasProi = typeof proxyWeakness === "number";
    const proi = hasProi ? proxyWeakness * row.weight : getProiScore(row);
    const weakness = getWeaknessScore(row);

    const current = byKey.get(key);
    if (!current) {
      byKey.set(key, {
        categoryType: row.categoryType,
        name: row.name,
        weight: row.weight,
        roi,
        proi,
        weakness,
        hasRoi: typeof row.accuracy === "number" || roi > 0,
        hasProi,
      });
      continue;
    }

    current.weight = Math.max(current.weight, row.weight);
    current.roi += roi;
    current.proi += proi;
    current.weakness = Math.max(current.weakness, weakness);
    current.hasRoi = current.hasRoi || typeof row.accuracy === "number" || roi > 0;
    current.hasProi = current.hasProi || hasProi;
  }

  return Array.from(byKey.values());
}

function buildTopReason(row: DisplayRow): string {
  if (row.hasRoi && row.hasProi) {
    return "Both QBank and score report indicate this as an important weakness.";
  }
  if (row.hasRoi) {
    return "Driven primarily by QBank weakness in a weighted area.";
  }
  return "Driven primarily by score-report proxy weakness in a weighted area.";
}

function buildNarrativeBullets(allRows: DisplayRow[]): string[] {
  if (allRows.length === 0) {
    return ["No categories were available for narrative analysis."];
  }

  const byImpact = [...allRows].sort((a, b) => b.roi + b.proi - (a.roi + a.proi));
  const byWeight = [...allRows].sort((a, b) => b.weight - a.weight);
  const overlap = byImpact.filter((row) => row.hasRoi && row.hasProi);
  const qbankOnly = byImpact.filter((row) => row.hasRoi && !row.hasProi);
  const scoreOnly = byImpact.filter((row) => row.hasProi && !row.hasRoi);

  const bullets: string[] = [];

  if (overlap.length > 0) {
    const top = overlap[0];
    bullets.push(
      `${top.name} appears in both data sources (ROI ${formatScore(top.roi)}, PROI ${formatScore(top.proi)}), suggesting a persistent weakness in a weighted area (${formatPercent(top.weight)}).`,
    );
  }

  if (qbankOnly.length > 0) {
    const top = qbankOnly[0];
    bullets.push(
      `${top.name} is mainly a QBank weakness (${formatPercent(top.weakness)} weakness, ROI ${formatScore(top.roi)}) with meaningful exam weight (${formatPercent(top.weight)}).`,
    );
  }

  if (scoreOnly.length > 0) {
    const top = scoreOnly[0];
    bullets.push(
      `${top.name} is primarily score-report driven (PROI ${formatScore(top.proi)}) and should still be addressed even without per-question counts.`,
    );
  }

  if (byWeight.length > 0) {
    const heavy = byWeight[0];
    bullets.push(
      `${heavy.name} has one of the highest blueprint weights (${formatPercent(heavy.weight)}), so moderate weakness here can move your overall outcome.`,
    );
  }

  const topTwo = byImpact.slice(0, 2);
  if (topTwo.length === 2) {
    bullets.push(
      `Focus first on ${topTwo[0].name} and ${topTwo[1].name}; together they carry the highest combined signal from ROI and PROI.`,
    );
  }

  return bullets.slice(0, 6);
}

function getSectionRows(rows: DisplayRow[], categoryType: CategoryType) {
  return rows.filter((row) => row.categoryType === categoryType);
}

function RankTable({ title, rows }: { title: string; rows: DisplayRow[] }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-stone-200 text-left text-xs uppercase tracking-wide text-stone-600">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Weight</th>
              <th className="px-3 py-2">ROI (QBank)</th>
              <th className="px-3 py-2">PROI (Score Report)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.categoryType}-${row.name}`} className="border-b border-stone-100 last:border-0">
                <td className="px-3 py-2 text-stone-900">{row.name}</td>
                <td className="px-3 py-2 text-stone-700">{formatPercent(row.weight)}</td>
                <td className="px-3 py-2 text-stone-700">{row.hasRoi ? formatScore(row.roi) : "—"}</td>
                <td className="px-3 py-2 text-stone-700">{row.hasProi ? formatScore(row.proi) : PROI_PLACEHOLDER}</td>
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
  const parsedRows = useSyncExternalStore(subscribeUploadSession, getClientParsedRows, getServerParsedRows);
  const aggregated = useMemo(() => aggregateRows(parsedRows), [parsedRows]);

  const sections = useMemo<TableSection[]>(() => {
    const generalRows = sortRowsByMode(aggregated, rankingMode);
    const categorySections = CATEGORY_ORDER.map((categoryType) => ({
      key: categoryType,
      title: `${CATEGORY_LABEL[categoryType]} Rank List`,
      rows: sortRowsByMode(getSectionRows(generalRows, categoryType), rankingMode),
    }));

    return [
      {
        key: "general",
        title: "General Combined List",
        rows: generalRows,
      },
      ...categorySections,
    ];
  }, [aggregated, rankingMode]);

  const topFocusRows = useMemo(
    () => [...aggregated].sort((a, b) => b.roi + b.proi - (a.roi + a.proi)).slice(0, 5),
    [aggregated],
  );
  const narrativeBullets = useMemo(() => buildNarrativeBullets(aggregated), [aggregated]);

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
      <BrandHeader subtitle="Review your Achilles Heels." />

      <Card>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h2 className="brand-title text-2xl font-semibold text-stone-900">Results</h2>
          <div className="flex flex-wrap items-center gap-2 md:justify-center">
            {(Object.keys(modeLabels) as RankingMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setRankingMode(mode)}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition ${
                  rankingMode === mode
                    ? "border-stone-800 bg-stone-800 text-amber-50"
                    : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
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
          <p>PROI = (proxyWeakness) x weight</p>
          <p className="text-stone-600">
            Higher PROI = bigger score gain if you improve this category (estimated from score report graph bars).
          </p>
          <p className="text-stone-600">
            Score reports don&apos;t provide per-category correct/total, so proxyWeakness is extracted from the score report
            graphs.
          </p>
        </div>
      </Card>

      {sections.map((section) => (
        <RankTable key={section.key} title={section.title} rows={section.rows} />
      ))}

      <Card title="Top focus areas">
        <ul className="space-y-3 text-sm text-stone-800">
          {topFocusRows.map((row) => (
            <li
              key={`top-${row.categoryType}-${row.name}`}
              className="rounded-md border border-stone-200 bg-stone-50/50 px-3 py-2"
            >
              <p className="font-semibold text-stone-900">
                {row.name} ({CATEGORY_LABEL[row.categoryType]})
              </p>
              <p className="text-stone-700">
                ROI: {row.hasRoi ? formatScore(row.roi) : "—"} | PROI:{" "}
                {row.hasProi ? formatScore(row.proi) : PROI_PLACEHOLDER}
              </p>
              <p className="text-stone-600">{buildTopReason(row)}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Achilles Insight">
        <ul className="list-disc space-y-2 pl-5 text-sm text-stone-800">
          {narrativeBullets.map((bullet) => (
            <li key={bullet}>{bullet}</li>
          ))}
        </ul>
      </Card>

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
