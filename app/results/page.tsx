"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearUploadSession, getUploadSession, type UploadSessionData } from "../lib/session";

type ResultsModel = {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
};

function buildMockResults(data: UploadSessionData): ResultsModel {
  const lowercaseText = data.pastedText?.toLowerCase() ?? "";
  const lowercaseFileName = data.fileName?.toLowerCase() ?? "";

  if (data.source === "text" && lowercaseText.includes("biology")) {
    return {
      summary:
        "Your pasted notes show stronger performance patterns in biology-related topics with room to tighten mixed-discipline consistency.",
      strengths: ["Biology recall", "Question pacing", "Pattern recognition"],
      weaknesses: ["Interdisciplinary integration", "Edge-case reasoning"],
      nextSteps: [
        "Review mixed-topic blocks 3x this week.",
        "Drill missed interdisciplinary questions.",
        "Retest with timed sets after review.",
      ],
    };
  }

  if (data.source === "file" && lowercaseFileName.includes("diagnostic")) {
    return {
      summary:
        "Your uploaded diagnostic appears baseline-oriented, showing foundational strengths but uneven accuracy in advanced topics.",
      strengths: ["Core concepts", "Basic interpretation"],
      weaknesses: ["Advanced reasoning", "Time under pressure"],
      nextSteps: [
        "Shift 60% of practice to advanced question sets.",
        "Use timed 40-question blocks twice weekly.",
        "Track errors by topic after each block.",
      ],
    };
  }

  const signalLength = data.source === "text" ? (data.pastedText?.trim().length ?? 0) : (data.fileName?.length ?? 0);

  if (signalLength > 120) {
    return {
      summary:
        "The provided input is detailed, suggesting broad topic coverage with a few weaker areas that need focused reinforcement.",
      strengths: ["Content coverage", "Consistency across core topics"],
      weaknesses: ["Low-frequency topics", "Second-pass accuracy"],
      nextSteps: [
        "Create a short weak-topic checklist before each session.",
        "Run one targeted review block daily.",
        "Measure progress with weekly mini-assessments.",
      ],
    };
  }

  return {
    summary:
      "The current input is brief, so this mock analysis emphasizes building a stronger baseline before deep optimization.",
    strengths: ["Study momentum", "Willingness to track performance"],
    weaknesses: ["Data depth", "Topic-level specificity"],
    nextSteps: [
      "Add more detailed subject-by-subject stats.",
      "Log missed questions by category.",
      "Re-run analysis after your next full practice session.",
    ],
  };
}

function SectionCard({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const uploadData = getUploadSession();

  if (!uploadData) {
    return (
      <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-6">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
        <p className="text-slate-700">No upload data found for this session.</p>
        <Link
          href="/upload"
          className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Go to Upload
        </Link>
      </section>
    );
  }

  const results = buildMockResults(uploadData);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Results</h1>
      </header>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Summary</h2>
        <p className="text-sm text-slate-700">{results.summary}</p>
      </section>

      <SectionCard title="Strengths" items={results.strengths} />
      <SectionCard title="Weaknesses" items={results.weaknesses} />
      <SectionCard title="Recommended next steps" items={results.nextSteps} />

      <button
        type="button"
        onClick={() => {
          clearUploadSession();
          router.push("/upload");
        }}
        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      >
        Start over
      </button>
    </section>
  );
}