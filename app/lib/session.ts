export type UploadSource = "file" | "text";

export type UploadSessionData = {
  source: UploadSource;
  fileName?: string;
  fileType?: string;
  pastedText?: string;
  savedAt: string;
};

const STORAGE_KEY = "achilles-upload-session";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
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
    return JSON.parse(raw) as UploadSessionData;
  } catch {
    window.sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setUploadSession(data: UploadSessionData) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearUploadSession() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(STORAGE_KEY);
}