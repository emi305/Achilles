"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert } from "../components/Alert";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { parseAnyCsv } from "../lib/parseAnyCsv";
import { setUploadSession } from "../lib/session";
import type { TemplateId } from "../lib/templates";
import {
  DEFAULT_SETTINGS,
  getTemplateSample,
  loadActiveProfileFromLocalStorage,
  loadProfilesFromLocalStorage,
  saveProfilesToLocalStorage,
  type ProfilesMap,
} from "../lib/uploadSettings";

const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg";

function getInitialSettings() {
  const profiles = loadProfilesFromLocalStorage();
  const activeProfile = loadActiveProfileFromLocalStorage(profiles);
  const currentSettings = profiles[activeProfile] ?? DEFAULT_SETTINGS;
  return { profiles, activeProfile, currentSettings };
}

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [profiles, setProfiles] = useState<ProfilesMap>(() => getInitialSettings().profiles);
  const [activeProfile] = useState(() => getInitialSettings().activeProfile);

  const currentSettings = profiles[activeProfile] ?? DEFAULT_SETTINGS;
  const templateChoice = currentSettings.templateChoice;
  const defaultCategoryType = currentSettings.defaultCategoryType;
  const pastedCsv = currentSettings.pastedCsv;

  useEffect(() => {
    saveProfilesToLocalStorage(profiles);
  }, [profiles]);

  const updateActiveProfileCsv = (nextCsv: string) => {
    setProfiles((prev) => ({
      ...prev,
      [activeProfile]: {
        ...(prev[activeProfile] ?? DEFAULT_SETTINGS),
        pastedCsv: nextCsv,
      },
    }));
  };

  const helperDescription = useMemo(() => {
    const templateLabel = templateChoice === "auto" ? "Auto-detect template" : `Template: ${templateChoice}`;
    return `${activeProfile} profile | ${templateLabel} | Default category: ${defaultCategoryType}`;
  }, [activeProfile, defaultCategoryType, templateChoice]);

  const onAnalyze = () => {
    const trimmedCsv = pastedCsv.trim();

    if (!selectedFile && !trimmedCsv) {
      setErrorMessage("Please upload a file or paste CSV before analyzing.");
      return;
    }

    if (selectedFile && !trimmedCsv) {
      setErrorMessage("File analysis is not supported yet. Please paste CSV text to analyze.");
      return;
    }

    try {
      const selectedTemplate: TemplateId | undefined = templateChoice === "auto" ? undefined : templateChoice;
      const parsedRows = parseAnyCsv(trimmedCsv, {
        template: selectedTemplate,
        defaultCategoryType,
      });

      setUploadSession({
        pastedCsv: trimmedCsv,
        parsedRows,
        savedAt: new Date().toISOString(),
      });

      setErrorMessage("");
      router.push("/results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse CSV. Please check the format.";
      setErrorMessage(message);
    }
  };

  return (
    <section className="space-y-8">
      <BrandHeader
        subtitle="Upload standardized test CSV. Paste your data from TrueLearn/UWorld/etc. Choose a template in Settings if auto-detect fails."
      />

      <Card title="Input" description={helperDescription}>
        <div className="flex justify-end">
          <Link href="/settings" className="text-sm font-medium text-stone-700 underline-offset-2 hover:underline">
            Open Settings
          </Link>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-stone-900" htmlFor="stats-csv-input">
            Paste CSV data
          </label>
          <textarea
            id="stats-csv-input"
            rows={11}
            value={pastedCsv}
            onChange={(event) => {
              updateActiveProfileCsv(event.target.value);
            }}
            placeholder="Paste CSV content here"
            className="w-full rounded-md border border-stone-300 bg-stone-50/30 px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              updateActiveProfileCsv(getTemplateSample(templateChoice));
              setErrorMessage("");
            }}
            className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Load sample
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            className="inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
          >
            Analyze
          </button>
        </div>

        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

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
          <p className="text-xs text-stone-500">File parsing coming later.</p>
        </div>
      </Card>
    </section>
  );
}
