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

type FileExtractionStatus = {
  filename: string;
  status: "queued" | "extracting" | "done" | "failed";
  message?: string;
};

export default function UploadPage() {
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [fileWarnings, setFileWarnings] = useState<string[]>([]);
  const [showAiSetupChecklist, setShowAiSetupChecklist] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [fileStatuses, setFileStatuses] = useState<FileExtractionStatus[]>([]);
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

  const updateActiveProfileText = (nextText: string) => {
    setProfiles((prev) => ({
      ...prev,
      [activeProfile]: {
        ...(prev[activeProfile] ?? DEFAULT_SETTINGS),
        pastedCsv: nextText,
      },
    }));
  };

  const handleAnalyzeCsv = async (inputText: string) => {
    try {
      const selectedTemplate: TemplateId | undefined = templateChoice === "auto" ? undefined : templateChoice;
      const parsedRows = parseAnyCsv(inputText, {
        template: selectedTemplate,
        defaultCategoryType,
      });

      if (parsedRows.length === 0) {
        setErrorMessage("Couldn’t read this report. Try again or switch to Advanced CSV.");
        return;
      }

      clearReviewSession();
      setUploadSession({
        pastedCsv: inputText,
        parsedRows,
        savedAt: new Date().toISOString(),
      });
      router.push("/results");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Analyze][CSV] parse error:", error);
      }
      setErrorMessage("Couldn’t read this report. Try again or switch to Advanced CSV.");
    }
  };

  const handleAnalyzeAi = async (inputText: string) => {
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
          return;
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
        setErrorMessage("Couldn’t read this report. Try again or switch to Advanced CSV.");
        return;
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
        return;
      }

      clearReviewSession();
      setUploadSession({
        pastedCsv: inputText,
        parsedRows: normalized.parsedRows,
        savedAt: new Date().toISOString(),
      });
      router.push("/results");
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Analyze][AI] extraction error:", error);
      }
      setErrorMessage("Couldn’t read this report. Try again or switch to Advanced CSV.");
      setShowAiSetupChecklist(false);
    }
  };

  const importFilesToText = async (): Promise<string> => {
    if (selectedFiles.length === 0) {
      setFileStatuses([]);
      return "";
    }

    const initialStatuses = selectedFiles.map((file) => ({
      filename: file.name,
      status: "queued" as const,
    }));
    setFileStatuses(initialStatuses);

    const formData = new FormData();
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      setProgressLabel(`Extracting ${index + 1}/${selectedFiles.length}: ${file.name}`);
      setFileStatuses((prev) =>
        prev.map((item, itemIndex) => (itemIndex === index ? { ...item, status: "extracting" } : item)),
      );
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
      setErrorMessage("Couldn’t read this file. Try a clearer image or paste text.");
      return "";
    }

    const payload = (await response.json()) as ImportFileResponse;
    const total = payload.results.length;
    const doneCount = payload.results.filter((item) => item.ok).length;
    setProgressLabel(`Extracting ${doneCount}/${total} complete`);
    setFileStatuses(
      payload.results.map((item) => ({
        filename: item.filename,
        status: item.ok ? "done" : "failed",
        message: item.message,
      })),
    );

    const warnings = payload.results
      .filter((item) => !item.ok)
      .map((item) => `${item.filename}: ${item.message ?? "Couldn’t read this file."}`);
    setFileWarnings(warnings);

    const successfulTexts = payload.results
      .filter((item) => item.ok && typeof item.text === "string" && item.text.trim().length > 0)
      .map((item) => `--- FILE: ${item.filename} ---\n${item.text?.trim() ?? ""}`);

    return successfulTexts.join("\n\n").trim();
  };

  const onAnalyze = async () => {
    const trimmedText = rawInput.trim();

    if (selectedFiles.length === 0 && !trimmedText) {
      setErrorMessage("Upload files or paste text before analyzing.");
      return;
    }

    setIsAnalyzing(true);
    setProgressLabel("");
    setErrorMessage("");
    setShowAiSetupChecklist(false);
    setFileWarnings([]);

    try {
      const importedText = await importFilesToText();
      const sections: string[] = [];
      if (importedText) {
        sections.push(importedText);
      }
      if (trimmedText) {
        sections.push(`--- PASTED TEXT ---\n${trimmedText}`);
      }

      const combinedText = sections.join("\n\n").trim();
      if (!combinedText) {
        setErrorMessage("Couldn’t read this file. Try a clearer image or paste text.");
        return;
      }

      if (parsingMode === "csv") {
        await handleAnalyzeCsv(combinedText);
      } else {
        await handleAnalyzeAi(combinedText);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="Upload standardized test data." />

      <p className="mx-auto max-w-2xl text-center text-sm text-stone-700 sm:text-base">
        Upload screenshots or PDFs first, then optionally add pasted text.
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

        <div className="space-y-3 rounded-md border border-stone-300 bg-stone-50/50 p-4">
          <h3 className="text-base font-semibold text-stone-900">Upload Test Data</h3>
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
                    setFileStatuses([]);
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

        {progressLabel ? <p className="text-sm text-stone-700">{progressLabel}</p> : null}

        {fileStatuses.length > 0 ? (
          <div className="space-y-1 rounded-md border border-stone-200 bg-stone-50/60 p-3 text-xs text-stone-700">
            {fileStatuses.map((item) => (
              <p key={`status-${item.filename}`}>
                {item.filename}:{" "}
                {item.status === "extracting"
                  ? "extracting..."
                  : item.status === "done"
                    ? "done"
                    : item.status === "failed"
                      ? "failed"
                      : "queued"}
              </p>
            ))}
          </div>
        ) : null}

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
