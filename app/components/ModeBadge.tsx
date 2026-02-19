"use client";

import { useEffect, useState } from "react";
import { getUploadSession } from "../lib/session";
import {
  DEFAULT_TEST_TYPE,
  getSelectedTestFromLocalStorage,
  getTestLabel,
  SELECTED_TEST_CHANGED_EVENT,
} from "../lib/testSelection";
import type { TestType } from "../lib/types";

function resolveTestType(): TestType {
  const fromSession = getUploadSession()?.selectedTest;
  if (fromSession) {
    return fromSession;
  }
  return getSelectedTestFromLocalStorage();
}

export function ModeBadge() {
  const [mounted, setMounted] = useState(false);
  const [testType, setTestType] = useState<TestType>(DEFAULT_TEST_TYPE);

  useEffect(() => {
    const sync = () => {
      setTestType(resolveTestType());
    };

    setMounted(true);
    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    window.addEventListener(SELECTED_TEST_CHANGED_EVENT, sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
      window.removeEventListener(SELECTED_TEST_CHANGED_EVENT, sync);
    };
  }, []);

  return <div className="settings-link">Mode: {getTestLabel(mounted ? testType : DEFAULT_TEST_TYPE)}</div>;
}
