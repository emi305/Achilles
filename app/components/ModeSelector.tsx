"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearUploadSession, getUploadSession } from "../lib/session";
import {
  DEFAULT_TEST_TYPE,
  getSelectedTestFromLocalStorage,
  getTestLabel,
  isTestType,
  setSelectedTestInLocalStorage,
  SELECTED_TEST_CHANGED_EVENT,
} from "../lib/testSelection";
import type { TestType } from "../lib/types";

function resolveTestType(): TestType {
  return getUploadSession()?.selectedTest ?? getSelectedTestFromLocalStorage();
}

export function ModeSelector() {
  const router = useRouter();
  const pathname = usePathname();
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

  return (
    <label className="settings-link mode-select-wrap">
      <span className="mode-select-label">Mode</span>
      <select
        value={mounted ? testType : DEFAULT_TEST_TYPE}
        onChange={(event) => {
          const nextValue = event.target.value;
          if (!isTestType(nextValue) || nextValue === testType) {
            return;
          }

          clearUploadSession();
          setSelectedTestInLocalStorage(nextValue);
          setTestType(nextValue);

          if (pathname === "/results") {
            router.push(`/upload?modeChanged=1&exam=${nextValue}`);
          }
        }}
        aria-label="Mode"
        className="mode-select-input"
      >
        <option value="comlex2">{getTestLabel("comlex2")}</option>
        <option value="usmle_step2">{getTestLabel("usmle_step2")}</option>
      </select>
    </label>
  );
}
