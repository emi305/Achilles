"use client";

import Link from "next/link";
import { useState } from "react";
import { BrandHeader } from "./components/BrandHeader";
import { setSelectedTestInLocalStorage } from "./lib/testSelection";
import type { TestType } from "./lib/types";

type ExamOption = "" | TestType;

export default function HomePage() {
  const [exam, setExam] = useState<ExamOption>("");

  return (
    <section className="space-y-10 pt-6 text-center sm:pt-10">
      <BrandHeader />

      <div className="mx-auto max-w-2xl rounded-lg border border-stone-200 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 text-left sm:flex-row sm:items-center">
          <p className="text-base font-semibold text-stone-900">What test are you studying for?</p>
          <select
            value={exam}
            onChange={(event) => {
              const value = event.target.value as ExamOption;
              setExam(value);
              if (value) {
                setSelectedTestInLocalStorage(value);
              }
            }}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 sm:w-64"
          >
            <option value="">Select...</option>
            <option value="comlex2">Comlex 2</option>
            <option value="usmle_step2">USMLE Step 2</option>
          </select>
        </div>

        {exam ? (
          <div className="mt-6 text-center">
            <Link
              href="/upload"
              onClick={() => setSelectedTestInLocalStorage(exam)}
              className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
            >
              Get started
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
