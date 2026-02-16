import type { ParsedRow, TestType } from "./types";
import { DEFAULT_TEST_TYPE, isTestType } from "./testSelection";

export type UploadSessionData = {
  selectedTest: TestType;
  pastedCsv: string;
  parsedRows: ParsedRow[];
  savedAt: string;
};

const STORAGE_KEY = "achilles-upload-session";
const UPLOAD_SESSION_CHANGED_EVENT = "upload-session-changed";
const EMPTY_ROWS: ParsedRow[] = [];

let cachedRows: ParsedRow[] = EMPTY_ROWS;
let cachedRaw: string | null = null;
const listeners = new Set<() => void>();
let hasWindowSubscriptions = false;

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

function parseRowsFromRaw(raw: string | null): ParsedRow[] {
  if (!raw) {
    return EMPTY_ROWS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UploadSessionData>;
    if (!Array.isArray(parsed?.parsedRows) || parsed.parsedRows.length === 0) {
      return EMPTY_ROWS;
    }
    const selectedTest = isTestType(parsed.selectedTest) ? parsed.selectedTest : DEFAULT_TEST_TYPE;
    return parsed.parsedRows.map((row) => ({
      ...row,
      testType: row.testType ?? selectedTest,
    }));
  } catch {
    if (canUseSessionStorage()) {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
    return EMPTY_ROWS;
  }
}

function setCachedFromRaw(raw: string | null): boolean {
  if (raw === cachedRaw) {
    return false;
  }

  cachedRaw = raw;
  cachedRows = parseRowsFromRaw(raw);
  return true;
}

function hydrateFromSessionStorageIfNeeded() {
  if (!canUseSessionStorage()) {
    return;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  setCachedFromRaw(raw);
}

function ensureWindowSubscriptions() {
  if (!canUseSessionStorage() || hasWindowSubscriptions) {
    return;
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    const didChange = setCachedFromRaw(event.newValue);
    if (didChange) {
      emitChange();
    }
  };

  const onLocalSessionChanged = () => {
    hydrateFromSessionStorageIfNeeded();
    emitChange();
  };

  window.addEventListener("storage", onStorage);
  window.addEventListener(UPLOAD_SESSION_CHANGED_EVENT, onLocalSessionChanged);
  hasWindowSubscriptions = true;
}

export function subscribeUploadSession(callback: () => void) {
  listeners.add(callback);
  ensureWindowSubscriptions();

  return () => {
    listeners.delete(callback);
  };
}

export function getClientParsedRows(): ParsedRow[] {
  if (typeof window === "undefined") {
    return cachedRows;
  }

  hydrateFromSessionStorageIfNeeded();
  return cachedRows;
}

export function getServerParsedRows(): ParsedRow[] {
  return cachedRows;
}

export function getUploadSession(): UploadSessionData | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<UploadSessionData>;
    const selectedTest = isTestType(parsed.selectedTest) ? parsed.selectedTest : DEFAULT_TEST_TYPE;
    const parsedRows = Array.isArray(parsed.parsedRows)
      ? parsed.parsedRows.map((row) => ({ ...row, testType: row.testType ?? selectedTest }))
      : [];

    if (parsedRows.length === 0) {
      return null;
    }

    return {
      selectedTest,
      pastedCsv: typeof parsed.pastedCsv === "string" ? parsed.pastedCsv : "",
      parsedRows,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
    };
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setUploadSession(data: UploadSessionData) {
  if (!canUseSessionStorage()) {
    return;
  }

  const raw = JSON.stringify(data);
  window.sessionStorage.setItem(STORAGE_KEY, raw);
  setCachedFromRaw(raw);
  window.dispatchEvent(new Event(UPLOAD_SESSION_CHANGED_EVENT));
}

export function clearUploadSession() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
  setCachedFromRaw(null);
  window.dispatchEvent(new Event(UPLOAD_SESSION_CHANGED_EVENT));
}
