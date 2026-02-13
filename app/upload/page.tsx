"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert } from "../components/Alert";
import { Card } from "../components/Card";
import { parseAnyCsv } from "../lib/parseAnyCsv";
import { setUploadSession } from "../lib/session";
import { TEMPLATE_OPTIONS, type TemplateChoice, type TemplateId } from "../lib/templates";
import type { CategoryType } from "../lib/types";

const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg";
const PROFILE_STORAGE_KEY = "achilles-upload-profiles";
const ACTIVE_PROFILE_STORAGE_KEY = "achilles-active-profile";

type ProfileSettings = {
  templateChoice: TemplateChoice;
  defaultCategoryType: CategoryType;
  pastedCsv: string;
};

type ProfilesMap = Record<string, ProfileSettings>;

const DEFAULT_PROFILE_NAME = "Default";

const DEFAULT_SETTINGS: ProfileSettings = {
  templateChoice: "auto",
  defaultCategoryType: "discipline",
  pastedCsv: "",
};

function getTemplateSample(templateChoice: TemplateChoice): string {
  if (templateChoice === "category_performance") {
    return [
      "Category,Correct,Incorrect,Total",
      '"Internal Medicine",50,30,80',
      '"Family Medicine",32,18,50',
      '"Emergency Medicine",18,12,30',
    ].join("\n");
  }

  if (templateChoice === "percent_correct") {
    return [
      "Category,PercentCorrect,Total",
      '"Internal Medicine",0.63,80',
      '"Family Medicine",0.64,50',
      '"Emergency Medicine",0.60,30',
    ].join("\n");
  }

  return [
    "categoryType,name,correct,total",
    'competency_domain,"Application of Knowledge for Osteopathic Medical Practice",42,60',
    'clinical_presentation,"Patient Presentations Related to the Musculoskeletal System",18,30',
    'discipline,"Internal Medicine",50,80',
  ].join("\n");
}

function loadProfilesFromLocalStorage(): ProfilesMap {
  if (typeof window === "undefined") {
    return { [DEFAULT_PROFILE_NAME]: DEFAULT_SETTINGS };
  }

  const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!raw) {
    return { [DEFAULT_PROFILE_NAME]: DEFAULT_SETTINGS };
  }

  try {
    const parsed = JSON.parse(raw) as ProfilesMap;
    return {
      [DEFAULT_PROFILE_NAME]: DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { [DEFAULT_PROFILE_NAME]: DEFAULT_SETTINGS };
  }
}

function loadActiveProfileFromLocalStorage(profiles: ProfilesMap): string {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE_NAME;
  }

  const raw = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PROFILE_NAME;
  }

  return profiles[raw] ? raw : DEFAULT_PROFILE_NAME;
}

function saveProfilesToLocalStorage(profiles: ProfilesMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

function saveActiveProfileToLocalStorage(profileName: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileName);
}

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [profiles, setProfiles] = useState<ProfilesMap>(() => loadProfilesFromLocalStorage());
  const [activeProfile, setActiveProfile] = useState(() => {
    const initialProfiles = loadProfilesFromLocalStorage();
    return loadActiveProfileFromLocalStorage(initialProfiles);
  });
  const [newProfileName, setNewProfileName] = useState("");
  const currentSettings = profiles[activeProfile] ?? DEFAULT_SETTINGS;
  const templateChoice = currentSettings.templateChoice;
  const defaultCategoryType = currentSettings.defaultCategoryType;
  const pastedCsv = currentSettings.pastedCsv;

  useEffect(() => {
    saveProfilesToLocalStorage(profiles);
  }, [profiles]);

  useEffect(() => {
    saveActiveProfileToLocalStorage(activeProfile);
  }, [activeProfile]);

  const isDefaultCategoryVisible = useMemo(
    () => templateChoice === "category_performance" || templateChoice === "percent_correct",
    [templateChoice],
  );

  const updateActiveProfileSettings = (partial: Partial<ProfileSettings>) => {
    setProfiles((prev) => {
      const previousSettings = prev[activeProfile] ?? DEFAULT_SETTINGS;
      return {
        ...prev,
        [activeProfile]: {
          ...previousSettings,
          ...partial,
        },
      };
    });
  };

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

  const onSwitchProfile = (profileName: string) => {
    setActiveProfile(profileName);
    setErrorMessage("");
  };

  const onCreateProfile = () => {
    const trimmedName = newProfileName.trim();
    if (!trimmedName) {
      setErrorMessage("Enter a profile name to create a new profile.");
      return;
    }

    if (profiles[trimmedName]) {
      onSwitchProfile(trimmedName);
      setNewProfileName("");
      return;
    }

    setProfiles((prev) => ({
      ...prev,
      [trimmedName]: {
        templateChoice,
        defaultCategoryType,
        pastedCsv,
      },
    }));
    setNewProfileName("");
    setActiveProfile(trimmedName);
    setErrorMessage("");
  };

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload standardized test CSV</h1>
        <p className="text-slate-700">
          Paste your export from TrueLearn/UWorld/etc. Choose a template if auto-detect fails.
        </p>
      </header>

      <Card title="Settings">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900" htmlFor="profile-select">
              Profile
            </label>
            <select
              id="profile-select"
              value={activeProfile}
              onChange={(event) => {
                onSwitchProfile(event.target.value);
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {Object.keys(profiles).map((profileName) => (
                <option key={profileName} value={profileName}>
                  {profileName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900" htmlFor="new-profile-name">
              Create new profile
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="new-profile-name"
                value={newProfileName}
                onChange={(event) => {
                  setNewProfileName(event.target.value);
                }}
                placeholder="Profile name"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={onCreateProfile}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-900" htmlFor="template-choice">
              CSV Template
            </label>
            <select
              id="template-choice"
              value={templateChoice}
              onChange={(event) => {
                updateActiveProfileSettings({
                  templateChoice: event.target.value as TemplateChoice,
                });
              }}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
            >
              {TEMPLATE_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {isDefaultCategoryVisible ? (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-900" htmlFor="default-category-type">
                Default category type
              </label>
              <select
                id="default-category-type"
                value={defaultCategoryType}
                onChange={(event) => {
                  updateActiveProfileSettings({
                    defaultCategoryType: event.target.value as CategoryType,
                  });
                }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="discipline">discipline</option>
                <option value="competency_domain">competency_domain</option>
                <option value="clinical_presentation">clinical_presentation</option>
              </select>
            </div>
          ) : null}
        </div>
      </Card>

      <Card title="Input">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-900" htmlFor="stats-csv-input">
            Paste CSV text
          </label>
          <textarea
            id="stats-csv-input"
            rows={11}
            value={pastedCsv}
            onChange={(event) => {
              updateActiveProfileSettings({
                pastedCsv: event.target.value,
              });
            }}
            placeholder="Paste CSV content here"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              updateActiveProfileSettings({
                pastedCsv: getTemplateSample(templateChoice),
              });
              setErrorMessage("");
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Load sample
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Analyze
          </button>
        </div>

        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

        <div className="space-y-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-3">
          <label className="block text-sm font-medium text-slate-700" htmlFor="stats-file-upload">
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
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <p className="text-xs text-slate-500">File parsing coming later.</p>
        </div>
      </Card>
    </section>
  );
}
