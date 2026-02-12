"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseCsv } from "../lib/parseCsv";
import { setUploadSession } from "../lib/session";

const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg";

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedCsv, setPastedCsv] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onAnalyze = () => {
    const trimmedCsv = pastedCsv.trim();

    if (!selectedFile && !trimmedCsv) {
      setErrorMessage("Please upload a file or paste CSV before analyzing.");
      return;
    }

    if (selectedFile && !trimmedCsv) {
      setErrorMessage("File analysis is not supported yet. Please paste CSV text to analyze.");
      return;
    }

    try {
      const parsedRows = parseCsv(trimmedCsv);

      setUploadSession({
        pastedCsv: trimmedCsv,
        parsedRows,
        savedAt: new Date().toISOString(),
      });

      setErrorMessage("");
      router.push("/results");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to parse CSV. Please check the format.";
      setErrorMessage(message);
    }
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload standardized test CSV</h1>
        <p className="text-slate-700">
          Paste CSV in this format: <code>categoryType, name, correct, total</code>.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-900" htmlFor="stats-file-upload">
            Upload file (.pdf, .png, .jpg, .jpeg)
          </label>
          <input
            id="stats-file-upload"
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={(event) => {
              const nextFile = event.target.files?.[0] ?? null;
              setSelectedFile(nextFile);
            }}
            className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          />
          <p className="text-xs text-slate-500">File-only analysis is not supported yet in this MVP.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-900" htmlFor="stats-csv-input">
            Or paste CSV text
          </label>
          <textarea
            id="stats-csv-input"
            rows={10}
            value={pastedCsv}
            onChange={(event) => {
              setPastedCsv(event.target.value);
            }}
            placeholder="categoryType, name, correct, total&#10;competency_domain, Application of Knowledge for Osteopathic Medical Practice, 42, 60"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400"
          />
        </div>

        {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}

        <button
          type="button"
          onClick={onAnalyze}
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Analyze
        </button>
      </div>
    </section>
  );
}