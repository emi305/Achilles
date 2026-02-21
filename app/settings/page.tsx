"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { LogoutButton } from "../components/LogoutButton";
import { TEMPLATE_OPTIONS, type TemplateChoice } from "../lib/templates";
import type { CategoryType } from "../lib/types";
import { createSupabaseBrowserClient } from "../lib/supabase/client";
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

type AccountInfo = {
  displayName: string;
  email: string;
};

function getInitialSettings() {
  const profiles = loadProfilesFromLocalStorage();
  const activeProfile = loadActiveProfileFromLocalStorage(profiles);
  return { profiles, activeProfile };
}

function deriveDisplayName(email: string | null, metadata: Record<string, unknown> | null | undefined): string {
  const fullName = typeof metadata?.full_name === "string" ? metadata.full_name.trim() : "";
  if (fullName) {
    return fullName;
  }

  const name = typeof metadata?.name === "string" ? metadata.name.trim() : "";
  if (name) {
    return name;
  }

  if (email && email.includes("@")) {
    const localPart = email.split("@")[0]?.trim();
    if (localPart) {
      return localPart;
    }
  }

  return "User";
}

export default function SettingsPage() {
  const [profiles, setProfiles] = useState<ProfilesMap>(() => getInitialSettings().profiles);
  const [activeProfile] = useState(() => getInitialSettings().activeProfile);
  const [account, setAccount] = useState<AccountInfo>({ displayName: "User", email: "Not available" });

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

  useEffect(() => {
    let cancelled = false;

    const loadAccount = async () => {
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) {
        return;
      }

      const email = user?.email ?? "Not available";
      const displayName = deriveDisplayName(user?.email ?? null, (user?.user_metadata as Record<string, unknown> | null) ?? null);
      setAccount({ displayName, email });
    };

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

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

  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="Settings are saved locally and used when analyzing your CSV data." />

      <Card title="Settings">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-stone-900">Account</h3>
          <div className="rounded-md border border-stone-200 bg-stone-50 p-3 text-sm text-stone-700">
            <p>
              Name: <span className="font-semibold text-stone-900">{account.displayName}</span>
            </p>
            <p>
              Email: <span className="font-semibold text-stone-900">{account.email}</span>
            </p>
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
                <option value="system">system</option>
                <option value="physician_task">physician_task</option>
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/upload"
            className="inline-flex items-center rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Back to Upload
          </Link>
          <LogoutButton className="inline-flex items-center rounded-md bg-stone-800 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-60" />
        </div>

        {/* Keep local settings storage keyed by existing profile id for backward compatibility. */}
        <input type="hidden" value={activeProfile || DEFAULT_PROFILE_NAME} readOnly />
      </Card>
    </section>
  );
}
