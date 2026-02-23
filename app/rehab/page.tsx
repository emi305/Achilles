"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandHeader } from "../components/BrandHeader";
import { Card } from "../components/Card";
import { RehabPanel } from "../components/RehabPanel";
import { getUploadSession } from "../lib/session";
import {
  DEFAULT_TEST_TYPE,
  getSelectedTestFromLocalStorage,
  getTestLabel,
  isTestType,
  setSelectedTestInLocalStorage,
} from "../lib/testSelection";
import type { TestType } from "../lib/types";

function resolveRehabExamMode(queryValue: string | null): TestType {
  if (isTestType(queryValue)) {
    return queryValue;
  }

  const fromSession = getUploadSession()?.selectedTest;
  if (fromSession) {
    return fromSession;
  }

  return getSelectedTestFromLocalStorage();
}

export default function RehabPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [examMode, setExamMode] = useState<TestType>(DEFAULT_TEST_TYPE);

  useEffect(() => {
    const nextExamMode = resolveRehabExamMode(searchParams.get("examMode"));
    setExamMode(nextExamMode);
    setSelectedTestInLocalStorage(nextExamMode);
  }, [searchParams]);

  return (
    <section className="space-y-8 pt-6 sm:pt-10">
      <BrandHeader subtitle="Rehab tracks whether your Achilles heel is actually shrinking across repeated analyses." />

      <Card className="print-hide">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <h2 className="brand-title text-2xl font-semibold text-stone-900">REHAB: {getTestLabel(examMode)}</h2>
            <p className="text-sm text-stone-700">
              Progress-focused trend view using saved snapshots from your Results runs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="text-sm font-medium text-stone-700" htmlFor="rehab-exam-mode">
              Exam
            </label>
            <select
              id="rehab-exam-mode"
              value={examMode}
              onChange={(event) => {
                const nextValue = event.target.value;
                if (!isTestType(nextValue) || nextValue === examMode) {
                  return;
                }
                setExamMode(nextValue);
                setSelectedTestInLocalStorage(nextValue);
                router.replace(`/rehab?examMode=${encodeURIComponent(nextValue)}`);
              }}
              className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
            >
              <option value="comlex2">{getTestLabel("comlex2")}</option>
              <option value="usmle_step2">{getTestLabel("usmle_step2")}</option>
            </select>

            <Link
              href="/results"
              className="inline-flex items-center rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
            >
              Back to Results
            </Link>
          </div>
        </div>
      </Card>

      <RehabPanel examMode={examMode} />
    </section>
  );
}
