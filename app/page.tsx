import Link from "next/link";
import { BrandHeader } from "./components/BrandHeader";

export default function HomePage() {
  return (
    <section className="space-y-8 text-center">
      <BrandHeader />
      <p className="mx-auto max-w-2xl text-stone-700">
        Turn your standardized test practice data into a quick summary of strengths, weaknesses, and
        actionable next steps. Upload a file or paste text, then review your Achilles Heels.
      </p>
      <Link
        className="inline-flex items-center rounded-md bg-stone-800 px-5 py-2.5 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
        href="/upload"
      >
        Get started
      </Link>
    </section>
  );
}
