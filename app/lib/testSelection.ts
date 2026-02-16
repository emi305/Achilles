import type { TestType } from "./types";

export const SELECTED_TEST_STORAGE_KEY = "achilles-selected-test";
export const SELECTED_TEST_CHANGED_EVENT = "achilles-selected-test-changed";
export const DEFAULT_TEST_TYPE: TestType = "comlex2";
export const TEST_LABELS: Record<TestType, string> = {
  comlex2: "COMLEX 2",
  usmle_step2: "USMLE Step 2",
};

function canUseLocalStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function isTestType(value: unknown): value is TestType {
  return value === "comlex2" || value === "usmle_step2";
}

export function getSelectedTestFromLocalStorage(): TestType {
  if (!canUseLocalStorage()) {
    return DEFAULT_TEST_TYPE;
  }

  const raw = window.localStorage.getItem(SELECTED_TEST_STORAGE_KEY);
  return isTestType(raw) ? raw : DEFAULT_TEST_TYPE;
}

export function setSelectedTestInLocalStorage(testType: TestType) {
  if (!canUseLocalStorage()) {
    return;
  }
  window.localStorage.setItem(SELECTED_TEST_STORAGE_KEY, testType);
  window.dispatchEvent(new Event(SELECTED_TEST_CHANGED_EVENT));
}

export function getTestLabel(testType: TestType): string {
  return TEST_LABELS[testType];
}
