import type { ParsedRow, TestType } from "./types";
import { DEFAULT_TEST_TYPE, isTestType } from "./testSelection";
import { normalizeRowForMapping } from "./normalizeRowForMapping";

export type UploadSessionData = {
  selectedTest: TestType;
  scoreReportProvided?: boolean;
  pastedCsv: string;
  parsedRows: ParsedRow[];
  savedAt: string;
};

type UploadSessionStored = {
  schemaVersion: number;
  savedAt: string;
  payload: UploadSessionData;
};

const STORAGE_KEY = "achilles-upload-session";
const UPLOAD_SESSION_CHANGED_EVENT = "upload-session-changed";
const UPLOAD_SESSION_SCHEMA_VERSION = 2;
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

function normalizeSessionPayload(payload: Partial<UploadSessionData>): UploadSessionData | null {
  const selectedTest = isTestType(payload.selectedTest) ? payload.selectedTest : DEFAULT_TEST_TYPE;
  const parsedRows = Array.isArray(payload.parsedRows)
    ? payload.parsedRows.map((row) =>
        normalizeRowForMapping(selectedTest, {
          ...row,
          testType: row.testType ?? selectedTest,
        }),
      )
    : [];

  if (parsedRows.length === 0) {
    return null;
  }

  return {
    selectedTest,
    scoreReportProvided: typeof payload.scoreReportProvided === "boolean" ? payload.scoreReportProvided : undefined,
    pastedCsv: typeof payload.pastedCsv === "string" ? payload.pastedCsv : "",
    parsedRows,
    savedAt: typeof payload.savedAt === "string" ? payload.savedAt : new Date().toISOString(),
  };
}

function serializeStoredSession(data: UploadSessionData): string {
  const wrapped: UploadSessionStored = {
    schemaVersion: UPLOAD_SESSION_SCHEMA_VERSION,
    savedAt: data.savedAt,
    payload: data,
  };
  return JSON.stringify(wrapped);
}

function parseSessionRaw(raw: string | null): { data: UploadSessionData | null; normalizedRaw: string | null } {
  if (!raw) {
    return { data: null, normalizedRaw: null };
  }

  const parsed = JSON.parse(raw) as Partial<UploadSessionData> | Partial<UploadSessionStored>;
  const isWrapped =
    !!parsed &&
    typeof parsed === "object" &&
    "payload" in parsed &&
    (parsed as Partial<UploadSessionStored>).payload !== undefined;
  const payload = isWrapped
    ? ((parsed as Partial<UploadSessionStored>).payload as Partial<UploadSessionData>)
    : (parsed as Partial<UploadSessionData>);

  const normalized = normalizeSessionPayload(payload);
  if (!normalized) {
    return { data: null, normalizedRaw: null };
  }

  return { data: normalized, normalizedRaw: serializeStoredSession(normalized) };
}

function parseRowsFromRaw(raw: string | null): ParsedRow[] {
  try {
    const parsed = parseSessionRaw(raw);
    return parsed.data?.parsedRows ?? EMPTY_ROWS;
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
  let rawForCache = raw;
  try {
    const parsed = parseSessionRaw(raw);
    if (raw && parsed.normalizedRaw && parsed.normalizedRaw !== raw) {
      window.sessionStorage.setItem(STORAGE_KEY, parsed.normalizedRaw);
      rawForCache = parsed.normalizedRaw;
    } else if (raw && !parsed.data) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      rawForCache = null;
    }
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    rawForCache = null;
  }
  setCachedFromRaw(rawForCache);
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
    const parsed = parseSessionRaw(raw);
    if (!parsed.data) {
      return null;
    }
    if (parsed.normalizedRaw && parsed.normalizedRaw !== raw) {
      window.sessionStorage.setItem(STORAGE_KEY, parsed.normalizedRaw);
      setCachedFromRaw(parsed.normalizedRaw);
    }
    return parsed.data;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setUploadSession(data: UploadSessionData) {
  if (!canUseSessionStorage()) {
    return;
  }

  const normalizedPayload = normalizeSessionPayload(data);
  if (!normalizedPayload) {
    clearUploadSession();
    return;
  }
  const raw = serializeStoredSession(normalizedPayload);
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
