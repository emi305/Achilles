"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../components/Alert";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { normalizeExtractRows, normalizeExtractedRow } from "../lib/normalizeExtract";
import { parseAnyCsv } from "../lib/parseAnyCsv";
import { clearReviewSession, setReviewSession } from "../lib/reviewSession";
import { mergeScoreReportProxyRows, type ScoreReportProxyRow } from "../lib/scoreReportParse";
import { setUploadSession } from "../lib/session";
import type { ExtractResponse, ParsedRow } from "../lib/types";
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

type ImportFileResult = {
  filename: string;
  ok: boolean;
  text?: string;
  error?: string;
  message?: string;
};

type ImportFileResponse = {
  results: ImportFileResult[];
};

type ScoreReportParseResponse = {
  proxyRows: ScoreReportProxyRow[];
  warnings: string[];
  results: Array<{ filename: string; ok: boolean; message?: string }>;
};

export default function UploadPage() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [scoreReportFiles, setScoreReportFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [scoreReportWarnings, setScoreReportWarnings] = useState<string[]>([]);
  const [showAiSetupChecklist, setShowAiSetupChecklist] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingDots, setAnalyzingDots] = useState(1);
  const [profiles, setProfiles] = useState<ProfilesMap>(() => getInitialSettings().profiles);
  const [activeProfile, setActiveProfile] = useState(() => getInitialSettings().activeProfile);

  const currentSettings = profiles[activeProfile] ?? DEFAULT_SETTINGS;
  const templateChoice = currentSettings.templateChoice;
  const defaultCategoryType = currentSettings.defaultCategoryType;
  const parsingMode = currentSettings.parsingMode;
  const rawInput = currentSettings.pastedCsv;

  useEffect(() => {
    saveProfilesToLocalStorage(profiles);
  }, [profiles]);

  useEffect(() => {
    if (!isAnalyzing) {
      setAnalyzingDots(1);
      return;
    }

    const intervalId = window.setInterval(() => {
      setAnalyzingDots((prev) => ((prev % 3) + 1));
    }, 350);

    return () => window.clearInterval(intervalId);
  }, [isAnalyzing]);

  const updateActiveProfileText = (nextText: string) => {
    setProfiles((prev) => ({
      ...prev,
      [activeProfile]: {
        ...(prev[activeProfile] ?? DEFAULT_SETTINGS),
        pastedCsv: nextText,
      },
    }));
  };

  const handleAnalyzeCsv = async (inputText: string): Promise<ParsedRow[] | null> => {
    try {
      const selectedTemplate: TemplateId | undefined = templateChoice === "auto" ? undefined : templateChoice;
      const parsedRows = parseAnyCsv(inputText, {
        template: selectedTemplate,
        defaultCategoryType,
      });

      if (parsedRows.length === 0) {
        setErrorMessage("Couldnâ€™t read this report. Try again or switch to Advanced CSV.");
        return null;
      }

      return parsedRows;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Analyze][CSV] parse error:", error);
      }
      setErrorMessage("Couldnâ€™t read this report. Try again or switch to Advanced CSV.");
      return null;
    }
  };

  const handleAnalyzeAi = async (inputText: string): Promise<ParsedRow[] | null> => {
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          exam: "comlex2",
          rawText: inputText,
        }),
      });

      if (!response.ok) {
        const errorBody = (await response.json().catch(() => null)) as ExtractApiError | null;
        if (errorBody?.error === "EXTRACTION_NOT_CONFIGURED") {
          setErrorMessage("AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.");
          setShowAiSetupChecklist(true);
          return null;
        }
        throw new Error(errorBody?.message ?? "Extraction failed.");
      }

      const extracted = (await response.json()) as ExtractResponse;
      const normalizedExtractedRows = extracted.rows.map((row) => normalizeExtractedRow(row));
      const normalized = normalizeExtractRows(normalizedExtractedRows);
      const combinedWarnings = [...extracted.warnings, ...normalized.warnings];
      const debugReview =
        typeof window !== "undefined" && new URLSearchParams(window.location.search).get("debug") === "1";

      if (normalized.hasMissingRequired || normalized.parsedRows.length === 0) {
        setErrorMessage("Couldnâ€™t read this report. Try again or switch to Advanced CSV.");
        return null;
      }

      const shouldReviewInDebug =
        debugReview &&
        (extracted.overallConfidence < 0.8 || combinedWarnings.length > 0 || normalized.hasMissingRequired);

      if (shouldReviewInDebug) {
        setReviewSession({
          rawText: inputText,
          extracted: {
            ...extracted,
            rows: normalizedExtractedRows,
            warnings: combinedWarnings,
          },
          parsedRows: normalized.parsedRows,
          savedAt: new Date().toISOString(),
        });
        router.push("/review");
        return null;
      }

      return normalized.parsedRows;
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Analyze][AI] extraction error:", error);
      }
      setErrorMessage("Couldnâ€™t read this report. Try again or switch to Advanced CSV.");
      setShowAiSetupChecklist(false);
      return null;
    }
  };

  const importFilesToText = async (): Promise<string> => {
    if (selectedFiles.length === 0) {
      return "";
    }

    const formData = new FormData();
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      formData.append("files", file);
      // Yield to UI so progress text updates while preparing upload.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const response = await fetch("/api/import-file", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as ExtractApiError | null;
      if (errorBody?.error === "EXTRACTION_NOT_CONFIGURED") {
        setErrorMessage("AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.");
        setShowAiSetupChecklist(true);
        return "";
      }
      setErrorMessage("Couldnâ€™t read this file. Try a clearer image or paste text.");
      return "";
    }

    const payload = (await response.json()) as ImportFileResponse;
    const warnings = payload.results
      .filter((item) => !item.ok)
      .map((item) => `${item.filename}: ${item.message ?? "Couldnâ€™t read this file."}`);
    setFileWarnings(warnings);

    const successfulTexts = payload.results
      .filter((item) => item.ok && typeof item.text === "string" && item.text.trim().length > 0)
      .map((item) => `--- FILE: ${item.filename} ---\n${item.text?.trim() ?? ""}`);

    return successfulTexts.join("\n\n").trim();
  };

  const parseScoreReports = async (): Promise<ScoreReportProxyRow[]> => {
    if (scoreReportFiles.length === 0) {
      return [];
    }

    const formData = new FormData();
    for (const file of scoreReportFiles) {
      formData.append("scoreReports", file);
    }

    const response = await fetch("/api/score-report", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => null)) as ExtractApiError | null;
      if (errorBody?.error === "EXTRACTION_NOT_CONFIGURED") {
        setErrorMessage("AI extraction is not configured. Add OPENAI_API_KEY to .env.local and restart npm run dev.");
        setShowAiSetupChecklist(true);
        return [];
      }

      setScoreReportWarnings(["Could not parse score report data."]);
      return [];
    }

    const payload = (await response.json()) as ScoreReportParseResponse;
    setScoreReportWarnings(payload.warnings ?? []);
    return Array.isArray(payload.proxyRows) ? payload.proxyRows : [];
  };

  const onAnalyze = async () => {
    const trimmedText = rawInput.trim();

    if (selectedFiles.length === 0 && !trimmedText && scoreReportFiles.length === 0) {
      setErrorMessage("Upload files, score report screenshots, or paste text before analyzing.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage("");
    setShowAiSetupChecklist(false);
    setFileWarnings([]);
    setScoreReportWarnings([]);

    try {
      const importedText = await importFilesToText();
      const scoreReportProxyRows = await parseScoreReports();
      const sections: string[] = [];
      if (importedText) {
        sections.push(importedText);
      }
      if (trimmedText) {
        sections.push(`--- PASTED TEXT ---\n${trimmedText}`);
      }

      const combinedText = sections.join("\n\n").trim();

      let parsedRows: ParsedRow[] | null = [];
      if (combinedText) {
        if (parsingMode === "csv") {
          parsedRows = await handleAnalyzeCsv(combinedText);
        } else {
          parsedRows = await handleAnalyzeAi(combinedText);
        }
      } else if (scoreReportProxyRows.length === 0) {
        setErrorMessage("Couldnâ€™t read this file. Try a clearer image or paste text.");
        return;
      }

      if (!parsedRows) {
        return;
      }

      const mergedRows = mergeScoreReportProxyRows(parsedRows, scoreReportProxyRows);
      clearReviewSession();
      setUploadSession({
        pastedCsv: combinedText,
        parsedRows: mergedRows,
        savedAt: new Date().toISOString(),
      });
      router.push("/results");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="Upload standardized test data." />

      <p className="mx-auto max-w-2xl text-center text-sm text-stone-700 sm:text-base">
        Upload screenshots and/or PDFs and/or text.
      </p>

      <Card title="INPUT DATA">
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

        <div className="space-y-3 rounded-md border border-stone-300 bg-stone-50/50 p-4">
          <h3 className="text-base font-semibold text-stone-900">Upload Question Bank Data</h3>
          <input
            id="stats-file-upload"
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setSelectedFiles(files);
            }}
            className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          />
          <p className="text-xs text-stone-600">Upload screenshots or PDFs (you can select multiple).</p>

          {selectedFiles.length > 0 ? (
            <div className="space-y-2 rounded-md border border-stone-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-stone-800">Selected files ({selectedFiles.length})</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFiles([]);
                  }}
                  className="text-xs font-medium text-stone-700 underline"
                >
                  Clear all
                </button>
              </div>
              <ul className="space-y-1 text-sm text-stone-700">
                {selectedFiles.map((file, index) => (
                  <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">{file.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
                      }}
                      className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-md border border-stone-300 bg-stone-50/50 p-4">
          <h3 className="text-base font-semibold text-stone-900">Upload Score Report</h3>
          <input
            id="score-report-upload"
            type="file"
            multiple
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              setScoreReportFiles(files);
            }}
            className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
          />
          <p className="text-xs text-stone-600">Upload screenshots or PDFs (you can select multiple).</p>

          {scoreReportFiles.length > 0 ? (
            <ul className="space-y-1 rounded-md border border-stone-200 bg-white p-3 text-sm text-stone-700">
              {scoreReportFiles.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between gap-3">
                  <span className="truncate">{file.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setScoreReportFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
                    }}
                    className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-700 hover:bg-stone-100"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-900" htmlFor="stats-input">
            Or paste text (optional)
          </label>
          <textarea
            id="stats-input"
            rows={10}
            value={rawInput}
            onChange={(event) => {
              updateActiveProfileText(event.target.value);
            }}
            placeholder="Paste text or CSV content here"
            className="w-full rounded-md border border-stone-300 bg-stone-50/30 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400"
          />
        </div>

        {isAnalyzing ? <p className="text-sm text-stone-700">{`Analyzing data${".".repeat(analyzingDots)}`}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isAnalyzing}
            className="inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {fileWarnings.length > 0 ? (
          <Alert variant="info">
            <div className="space-y-1">
              <p>Some files could not be read, but analysis continued:</p>
              <ul className="list-disc pl-5">
                {fileWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </Alert>
        ) : null}

        {scoreReportWarnings.length > 0 ? (
          <Alert variant="info">
            <div className="space-y-1">
              <p>Score report parsing notes:</p>
              <ul className="list-disc pl-5">
                {scoreReportWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </Alert>
        ) : null}

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
      </Card>
    </section>
  );
}

