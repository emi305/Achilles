import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Cinzel, Lora } from "next/font/google";
import "./globals.css";

const titleFont = Cinzel({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-greek-title",
});

const bodyFont = Lora({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-greek-body",
});

export const metadata: Metadata = {
  title: "Achilles Insight",
  description: "Upload standardized test input and get focused strengths and weakness insights.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className={`${titleFont.variable} ${bodyFont.variable} greek-theme min-h-screen overflow-x-hidden text-stone-900`}>
        <div aria-hidden className="greek-column greek-column-left" />
        <div aria-hidden className="greek-column greek-column-right" />

        <div className="fixed right-4 top-4 z-30">
          <Link
            href="/settings"
            className="rounded-md border border-stone-300 bg-white/90 px-3 py-2 text-sm font-medium text-stone-700 shadow-sm backdrop-blur transition hover:bg-white"
          >
            Settings
          </Link>
        </div>

        <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8 lg:px-10">{children}</main>
      </body>
    </html>
  );
}
