"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert } from "../components/Alert";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { normalizeExtractRows, normalizeExtractedRow } from "../lib/normalizeExtract";
import { parseAnyCsv } from "../lib/parseAnyCsv";
import { clearReviewSession, setReviewSession } from "../lib/reviewSession";
import { setUploadSession } from "../lib/session";
import type { ExtractResponse } from "../lib/types";
import type { TemplateId } from "../lib/templates";
import {
  DEFAULT_SETTINGS,
  loadActiveProfileFromLocalStorage,
  loadProfilesFromLocalStorage,
  saveProfilesToLocalStorage,
  type ProfilesMap,
} from "../lib/uploadSettings";

const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg";

function getInitialSettings() {
  const profiles = loadProfilesFromLocalStorage();
  const activeProfile = loadActiveProfileFromLocalStorage(profiles);
  return { profiles, activeProfile };
}

type ExtractApiError = {
  error?: string;
  message?: string;
};

export default function UploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [showAiSetupChecklist, setShowAiSetupChecklist] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [useAdvancedCsv, setUseAdvancedCsv] = useState(false);
  const [profiles, setProfiles] = useState<ProfilesMap>(() => getInitialSettings().profiles);
  const [activeProfile, setActiveProfile] = useState(() => getInitialSettings().activeProfile);

  const currentSettings = profiles[activeProfile] ?? DEFAULT_SETTINGS;
  const templateChoice = currentSettings.templateChoice;
  const defaultCategoryType = currentSettings.defaultCategoryType;
  const rawInput = currentSettings.pastedCsv;
  const debugReview = searchParams.get("debug") === "1";

  useEffect(() => {
    saveProfilesToLocalStorage(profiles);
  }, [profiles]);

  const updateActiveProfileText = (nextText: string) => {
    setProfiles((prev) => ({
      ...prev,
      [activeProfile]: {
        ...(prev[activeProfile] ?? DEFAULT_SETTINGS),
        pastedCsv: nextText,
      },
    }));
  };

  const handleAnalyzeCsv = async (trimmedText: string) => {
    try {
      const selectedTemplate: TemplateId | undefined = templateChoice === "auto" ? undefined : templateChoice;
      const parsedRows = parseAnyCsv(trimmedText, {
        template: selectedTemplate,
        defaultCategoryType,
      });

      if (parsedRows.length === 0) {
        setErrorMessage(
          "Could not parse as CSV. Either disable Advanced Parse as CSV (to use AI), or paste CSV that matches expected templates.",
        );
        return;
      }

      clearReviewSession();
      setUploadSession({
        pastedCsv: trimmedText,
        parsedRows,
        savedAt: new Date().toISOString(),
      });
      router.push("/results");
    } catch (error) {
      const message =
        error instanceof Error
          ? `CSV parse failed: ${error.message}`
          : "Could not parse as CSV. Either disable Advanced Parse as CSV (to use AI), or paste valid CSV.";
      setErrorMessage(message);
    }
  };

  const handleAnalyzeAi = async (trimmedText: string) => {
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exam: "comlex2",
          rawText: trimmedText,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as ExtractApiError | null;
        if (errorBody?.error === "EXTRACTION_NOT_CONFIGURED") {
          setErrorMessage("AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.");
          setShowAiSetupChecklist(true);
          return;
        }
        throw new Error(errorBody?.message ?? "Extraction failed.");
      }

      const extracted = (await response.json()) as ExtractResponse;
      const normalizedExtractedRows = extracted.rows.map((row) => normalizeExtractedRow(row));
      const normalized = normalizeExtractRows(normalizedExtractedRows);
      const combinedWarnings = [...extracted.warnings, ...normalized.warnings];

      if (normalized.hasMissingRequired || normalized.parsedRows.length === 0) {
        setErrorMessage("Couldn't read this report. Try again or switch to Advanced CSV.");
        return;
      }

      const shouldReviewInDebug =
        debugReview &&
        (extracted.overallConfidence < 0.8 || combinedWarnings.length > 0 || normalized.hasMissingRequired);

      if (shouldReviewInDebug) {
        setReviewSession({
          rawText: trimmedText,
          extracted: {
            ...extracted,
            rows: normalizedExtractedRows,
            warnings: combinedWarnings,
          },
          parsedRows: normalized.parsedRows,
          savedAt: new Date().toISOString(),
        });
        router.push("/review");
        return;
      }

      clearReviewSession();
      setUploadSession({
        pastedCsv: trimmedText,
        parsedRows: normalized.parsedRows,
        savedAt: new Date().toISOString(),
      });
      router.push("/results");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Analyze][AI] extraction error:", error);
      }
      setErrorMessage("Couldn't read this report. Try again or switch to Advanced CSV.");
      setShowAiSetupChecklist(false);
    }
  };

  const onAnalyze = async () => {
    const trimmedText = rawInput.trim();

    if (!selectedFile && !trimmedText) {
      setErrorMessage("Please paste text or CSV before analyzing.");
      return;
    }

    if (!trimmedText) {
      setErrorMessage("PDF/Image import is not available in Phase 3A. Please paste text to analyze.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setShowAiSetupChecklist(false);
    console.log("[Analyze] mode=", useAdvancedCsv ? "CSV" : "AI");

    try {
      if (useAdvancedCsv) {
        await handleAnalyzeCsv(trimmedText);
      } else {
        await handleAnalyzeAi(trimmedText);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="Upload standardized test data." />

      <p className="mx-auto max-w-2xl text-center text-sm text-stone-700 sm:text-base">
        Paste your score report text (anything), including messy copy/paste tables or CSV snippets.
      </p>

      <Card title="Input">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-900" htmlFor="profile-select">
            Profile
          </label>
          <select
            id="profile-select"
            value={activeProfile}
            onChange={(event) => {
              setActiveProfile(event.target.value);
              setErrorMessage("");
            }}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 sm:w-80"
          >
            {Object.keys(profiles).map((profileName) => (
              <option key={profileName} value={profileName}>
                {profileName}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-900" htmlFor="stats-input">
            Paste your score report text (anything)
          </label>
          <textarea
            id="stats-input"
            rows={12}
            value={rawInput}
            onChange={(event) => {
              updateActiveProfileText(event.target.value);
            }}
            placeholder="Paste text or CSV content here"
            className="w-full rounded-md border border-stone-300 bg-stone-50/30 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400"
          />
        </div>

        <div className="flex items-start gap-2 rounded-md border border-stone-200 bg-stone-50/60 px-3 py-2">
          <input
            id="advanced-csv-toggle"
            type="checkbox"
            checked={useAdvancedCsv}
            onChange={(event) => {
              setUseAdvancedCsv(event.target.checked);
            }}
            className="mt-0.5"
          />
          <div className="space-y-1">
            <label htmlFor="advanced-csv-toggle" className="text-sm font-medium text-stone-800">
              Advanced: Parse as CSV
            </label>
            <p className="text-xs text-stone-600">Uses deterministic CSV parsing and template detection.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-stone-600">
            Mode: {useAdvancedCsv ? "CSV" : "AI"}
          </span>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {errorMessage ? (
          <Alert variant="error">
            <div className="space-y-2">
              <p>{errorMessage}</p>
              {showAiSetupChecklist ? (
                <ol className="list-decimal space-y-1 pl-5">
                  <li>Create `.env.local` in project root</li>
                  <li>Add `OPENAI_API_KEY=...`</li>
                  <li>Restart dev server (stop + `npm run dev`)</li>
                  <li>
                    Open{" "}
                    <Link href="/api/health" className="underline">
                      /api/health
                    </Link>{" "}
                    to confirm `hasOpenAIKey=true`
                  </li>
                </ol>
              ) : null}
            </div>
          </Alert>
        ) : null}

        <div className="space-y-2 rounded-md border border-dashed border-stone-300 bg-stone-50/40 p-3">
          <label className="block text-sm font-medium text-stone-700" htmlFor="stats-file-upload">
            Upload file (.pdf, .png, .jpg, .jpeg)
          </label>
          <input
            id="stats-file-upload"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setSelectedFile(nextFile);
            }}
            className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          />
          <p className="text-xs text-stone-500">PDF/Image import coming next (Phase 3B/C).</p>
        </div>
      </Card>
    </section>
  );
}
