"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "../components/Alert";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { TEMPLATE_OPTIONS, type TemplateChoice } from "../lib/templates";
import type { CategoryType } from "../lib/types";
import {
  DEFAULT_PROFILE_NAME,
  DEFAULT_SETTINGS,
  loadActiveProfileFromLocalStorage,
  loadProfilesFromLocalStorage,
  saveActiveProfileToLocalStorage,
  saveProfilesToLocalStorage,
  type ParsingMode,
  type ProfileSettings,
  type ProfilesMap,
} from "../lib/uploadSettings";

function getInitialSettings() {
  const profiles = loadProfilesFromLocalStorage();
  const activeProfile = loadActiveProfileFromLocalStorage(profiles);
  return { profiles, activeProfile };
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<ProfilesMap>(() => getInitialSettings().profiles);
  const [activeProfile, setActiveProfile] = useState(() => getInitialSettings().activeProfile);
  const [newProfileName, setNewProfileName] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const currentSettings = profiles[activeProfile] ?? DEFAULT_SETTINGS;
  const templateChoice = currentSettings.templateChoice;
  const defaultCategoryType = currentSettings.defaultCategoryType;
  const parsingMode = currentSettings.parsingMode;

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
    setProfiles((prev) => ({
      ...prev,
      [activeProfile]: {
        ...(prev[activeProfile] ?? DEFAULT_SETTINGS),
        ...partial,
      },
    }));
  };

  const onCreateProfile = () => {
    const trimmedName = newProfileName.trim();
    if (!trimmedName) {
      setErrorMessage("Enter a profile name to create a new profile.");
      return;
    }

    if (profiles[trimmedName]) {
      setActiveProfile(trimmedName);
      setNewProfileName("");
      setErrorMessage("");
      return;
    }

    setProfiles((prev) => ({
      ...prev,
      [trimmedName]: { ...DEFAULT_SETTINGS },
    }));
    setActiveProfile(trimmedName);
    setNewProfileName("");
    setErrorMessage("");
  };

  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="Settings are saved locally per profile and used when analyzing your CSV data." />

      <Card title="Settings">
        <div className="grid gap-4 sm:grid-cols-2">
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
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              {Object.keys(profiles).map((profileName) => (
                <option key={profileName} value={profileName}>
                  {profileName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-900" htmlFor="new-profile-name">
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
                className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm text-stone-900"
              />
              <button
                type="button"
                onClick={onCreateProfile}
                className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-900" htmlFor="parsing-mode">
              Parsing mode
            </label>
            <select
              id="parsing-mode"
              value={parsingMode}
              onChange={(event) => {
                updateActiveProfileSettings({
                  parsingMode: event.target.value as ParsingMode,
                });
              }}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              <option value="ai">AI (default)</option>
              <option value="csv">Deterministic CSV</option>
            </select>
            <p className="text-xs text-stone-600">
              AI mode is recommended for pasted reports and uploaded files. CSV mode is for strict CSV inputs.
            </p>
          </div>

          <div />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-stone-900" htmlFor="template-choice">
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
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
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
              <label className="block text-sm font-medium text-stone-900" htmlFor="default-category-type">
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
                className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
              >
                <option value="discipline">discipline</option>
                <option value="competency_domain">competency_domain</option>
                <option value="clinical_presentation">clinical_presentation</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
          Active profile: <span className="font-semibold">{activeProfile || DEFAULT_PROFILE_NAME}</span>
        </div>

        {errorMessage ? <Alert variant="error">{errorMessage}</Alert> : null}

        <div>
          <Link
            href="/upload"
            className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Back to Upload
          </Link>
        </div>
      </Card>
    </section>
  );
}
