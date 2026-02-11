"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setUploadSession } from "../lib/session";

const ACCEPTED_FILE_TYPES = ".pdf,.png,.jpg,.jpeg";

export default function UploadPage() {
  const router = useRouter();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedText, setPastedText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const onAnalyze = () => {
    const trimmedText = pastedText.trim();

    if (!selectedFile && !trimmedText) {
      setErrorMessage("Please upload a file or paste text before analyzing.");
      return;
    }

    if (selectedFile) {
      setUploadSession({
        source: "file",
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        savedAt: new Date().toISOString(),
      });
    } else {
      setUploadSession({
        source: "text",
        pastedText: trimmedText,
        savedAt: new Date().toISOString(),
      });
    }

    setErrorMessage("");
    router.push("/results");
  };

  return (
    <section className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Upload standardized test input</h1>
        <p className="text-slate-700">
          Upload a report file or paste your practice stats text to generate insights.
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
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-900" htmlFor="stats-text-input">
            Or paste text
          </label>
          <textarea
            id="stats-text-input"
            rows={8}
            value={pastedText}
            onChange={(event) => {
              setPastedText(event.target.value);
            }}
            placeholder="Paste standardized test notes, breakdowns, or score details here..."
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