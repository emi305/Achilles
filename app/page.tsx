import Link from "next/link";

export default function HomePage() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Achilles Insight</h1>
      <p className="max-w-2xl text-slate-700">
        Upload your COMLEX practice stats to generate a ranked list of subjects from weakest to
        strongest, with COMLEX blueprint weight percentages included to help prioritize study time.
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