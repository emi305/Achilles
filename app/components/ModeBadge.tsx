"use client";

import { useEffect, useState } from "react";
import { getUploadSession } from "../lib/session";
import { getSelectedTestFromLocalStorage, getTestLabel } from "../lib/testSelection";
import type { TestType } from "../lib/types";

function resolveTestType(): TestType {
  const fromSession = getUploadSession()?.selectedTest;
  if (fromSession) {
    return fromSession;
  }
  return getSelectedTestFromLocalStorage();
}

export function ModeBadge() {
  const [testType, setTestType] = useState<TestType>(() => resolveTestType());

  useEffect(() => {
    const sync = () => {
      setTestType(resolveTestType());
    };

    sync();
    window.addEventListener("focus", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return <div className="settings-link">Mode: {getTestLabel(testType)}</div>;
}
