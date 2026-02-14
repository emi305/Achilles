import type { ReviewSessionData } from "./types";

const REVIEW_STORAGE_KEY = "achilles-review-session";

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function getReviewSession(): ReviewSessionData | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(REVIEW_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as ReviewSessionData;
  } catch {
    window.sessionStorage.removeItem(REVIEW_STORAGE_KEY);
    return null;
  }
}

export function setReviewSession(data: ReviewSessionData) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify(data));
}

export function clearReviewSession() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(REVIEW_STORAGE_KEY);
}
