"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../components/Alert";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { normalizeExtractRows } from "../lib/normalizeExtract";
import { clearReviewSession, getReviewSession } from "../lib/reviewSession";
import { setUploadSession } from "../lib/session";
import { getWeightForCategory } from "../lib/comlexWeights";
import type { CategoryType, ExtractedRow } from "../lib/types";

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function parseNumberInput(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function deriveRowValues(row: ExtractedRow) {
  const total = row.total;
  const correct = row.correct ?? (typeof row.percentCorrect === "number" && typeof total === "number"
    ? Math.round(row.percentCorrect * total)
    : undefined);

  if (typeof total !== "number" || total <= 0 || typeof correct !== "number") {
    return {
      error: "Enter valid correct and total values.",
      accuracy: undefined,
      weight: getWeightForCategory(row.categoryType, row.name),
      roi: undefined,
    };
  }

  if (correct < 0 || correct > total) {
    return {
      error: "Correct must be between 0 and total.",
      accuracy: undefined,
      weight: getWeightForCategory(row.categoryType, row.name),
      roi: undefined,
    };
  }

  const accuracy = correct / total;
  const weight = getWeightForCategory(row.categoryType, row.name);
  return {
    error: undefined,
    accuracy,
    weight,
    roi: (1 - accuracy) * weight,
  };
}

const DEFAULT_ROW: ExtractedRow = {
  categoryType: "discipline",
  name: "",
  correct: undefined,
  total: undefined,
  percentCorrect: undefined,
  confidence: 0.5,
};

export default function ReviewPage() {
  const router = useRouter();
  const reviewSession = getReviewSession();
  const [rows, setRows] = useState<ExtractedRow[]>(() => reviewSession?.extracted.rows ?? []);
  const [errorMessage, setErrorMessage] = useState("");

  const rowDerivations = useMemo(() => rows.map((row) => deriveRowValues(row)), [rows]);
  const normalized = useMemo(() => normalizeExtractRows(rows), [rows]);
  const hasInlineErrors = rowDerivations.some((entry) => Boolean(entry.error));

  if (!reviewSession) {
    return (
      <section className="space-y-8 pt-6 sm:pt-10">
        <BrandHeader subtitle="No review data found for this session." />
        <Card title="Review">
          <p className="text-sm text-stone-700">Start from Upload and run Analyze to generate rows for review.</p>
          <Link
            href="/upload"
            className="inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
          >
            Back to upload
          </Link>
        </Card>
      </section>
    );
  }

  const onUpdateRow = (index: number, updates: Partial<ExtractedRow>) => {
    setRows((prev) => prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...updates } : row)));
  };

  const onConfirm = () => {
    if (rows.length === 0) {
      setErrorMessage("Add at least one valid row before confirming.");
      return;
    }

    if (hasInlineErrors || normalized.hasMissingRequired || normalized.parsedRows.length === 0) {
      setErrorMessage("Please fix row errors before confirming.");
      return;
    }

    setUploadSession({
      pastedCsv: reviewSession.rawText,
      parsedRows: normalized.parsedRows,
      savedAt: new Date().toISOString(),
    });
    clearReviewSession();
    router.push("/results");
  };

  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="We extracted these results. Edit anything wrong, then confirm." />

      <Card title="Review extracted rows">
        <div className="space-y-2 text-sm text-stone-700">
          <p>Overall AI confidence: {formatPercent(reviewSession.extracted.overallConfidence)}</p>
          {reviewSession.extracted.warnings.length > 0 ? (
            <ul className="list-disc pl-5">
              {reviewSession.extracted.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-stone-700">
              <tr className="border-b border-stone-200">
                <th className="px-2 py-2">Category</th>
                <th className="px-2 py-2">Name</th>
                <th className="px-2 py-2">Correct</th>
                <th className="px-2 py-2">Total</th>
                <th className="px-2 py-2">Accuracy</th>
                <th className="px-2 py-2">Weight</th>
                <th className="px-2 py-2">ROI</th>
                <th className="px-2 py-2">Confidence</th>
                <th className="px-2 py-2">Action</th>
              </tr>
            </thead>
            <tbody className="text-stone-800">
              {rows.map((row, index) => {
                const derived = rowDerivations[index];
                return (
                  <tr key={`review-row-${index}`} className="border-b border-stone-100 align-top">
                    <td className="px-2 py-2">
                      <select
                        value={row.categoryType}
                        onChange={(event) => {
                          onUpdateRow(index, { categoryType: event.target.value as CategoryType });
                        }}
                        className="rounded-md border border-stone-300 bg-white px-2 py-1"
                      >
                        <option value="discipline">discipline</option>
                        <option value="competency_domain">competency_domain</option>
                        <option value="clinical_presentation">clinical_presentation</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={row.name}
                        onChange={(event) => {
                          onUpdateRow(index, { name: event.target.value });
                        }}
                        className="w-56 rounded-md border border-stone-300 px-2 py-1"
                      />
                      {derived.error ? <p className="mt-1 text-xs text-red-700">{derived.error}</p> : null}
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        value={row.correct ?? ""}
                        onChange={(event) => {
                          onUpdateRow(index, { correct: parseNumberInput(event.target.value), percentCorrect: undefined });
                        }}
                        className="w-20 rounded-md border border-stone-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={1}
                        value={row.total ?? ""}
                        onChange={(event) => {
                          onUpdateRow(index, { total: parseNumberInput(event.target.value) });
                        }}
                        className="w-20 rounded-md border border-stone-300 px-2 py-1"
                      />
                    </td>
                    <td className="px-2 py-2">{derived.accuracy !== undefined ? formatPercent(derived.accuracy) : "-"}</td>
                    <td className="px-2 py-2">{formatPercent(derived.weight)}</td>
                    <td className="px-2 py-2">{derived.roi !== undefined ? derived.roi.toFixed(4) : "-"}</td>
                    <td className="px-2 py-2">{formatPercent(row.confidence)}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => {
                          setRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
                        }}
                        className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={() => {
            setRows((prev) => [...prev, { ...DEFAULT_ROW }]);
          }}
          className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Add row
        </button>

        {normalized.warnings.length > 0 ? (
          <Alert variant="info">
            <ul className="list-disc pl-5">
              {normalized.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </Alert>
        ) : null}

        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
          >
            Confirm and see results
          </button>
          <Link
            href="/upload"
            className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Back to upload
          </Link>
        </div>
      </Card>
    </section>
  );
}
