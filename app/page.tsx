import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Achilles Insight</h1>
      <p className="max-w-2xl text-slate-700">
        Turn your standardized test practice data into a quick summary of strengths, weaknesses, and
        actionable next steps. Upload a file or paste text, then review your insights in one place.
      </p>
      <Link
        className="inline-flex items-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        href="/upload"
      >
        Go to Upload
      </Link>
    </section>
  );
}