"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { clearUploadSession, getUploadSession } from "../lib/session";
import {
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
  const [testType, setTestType] = useState<TestType>(() => resolveTestType());

  useEffect(() => {
    const sync = () => {
      setTestType(resolveTestType());
    };

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
        value={testType}
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
