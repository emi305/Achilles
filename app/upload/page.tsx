"use client";

export default function UploadPage() {
  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Upload COMLEX stats CSV</h1>
      <p className="text-slate-700">
        Upload your COMLEX practice statistics CSV so Achilles Insight can calculate and rank your
        weakest to strongest subjects.
      </p>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6">
        <label className="block text-sm font-medium text-slate-900" htmlFor="csv-upload">
          COMLEX stats CSV file
        </label>
        <input
          className="mt-3 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          id="csv-upload"
          name="csv-upload"
          accept=".csv"
          type="file"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
          Required CSV columns
        </h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>subject</li>
          <li>correct</li>
          <li>total</li>
        </ul>
      </div>
    </section>
  );
}