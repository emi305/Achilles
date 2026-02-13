import type { TemplateChoice } from "./templates";
import type { CategoryType } from "./types";

export const PROFILE_STORAGE_KEY = "achilles-upload-profiles";
export const ACTIVE_PROFILE_STORAGE_KEY = "achilles-active-profile";
export const DEFAULT_PROFILE_NAME = "Default";

export type ProfileSettings = {
  templateChoice: TemplateChoice;
  defaultCategoryType: CategoryType;
  pastedCsv: string;
};

export type ProfilesMap = Record<string, ProfileSettings>;

export const DEFAULT_SETTINGS: ProfileSettings = {
  templateChoice: "auto",
  defaultCategoryType: "discipline",
  pastedCsv: "",
};

export function getTemplateSample(templateChoice: TemplateChoice): string {
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

export function loadProfilesFromLocalStorage(): ProfilesMap {
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

export function loadActiveProfileFromLocalStorage(profiles: ProfilesMap): string {
  if (typeof window === "undefined") {
    return DEFAULT_PROFILE_NAME;
  }

  const raw = window.localStorage.getItem(ACTIVE_PROFILE_STORAGE_KEY);
  if (!raw) {
    return DEFAULT_PROFILE_NAME;
  }

  return profiles[raw] ? raw : DEFAULT_PROFILE_NAME;
}

export function saveProfilesToLocalStorage(profiles: ProfilesMap) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function saveActiveProfileToLocalStorage(profileName: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ACTIVE_PROFILE_STORAGE_KEY, profileName);
}
