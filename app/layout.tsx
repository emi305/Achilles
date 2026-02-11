import type { Metadata } from "next";
import type { ReactNode } from "react";
import { TopNav } from "./components/TopNav";
import "./globals.css";

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
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <TopNav />
        <main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">{children}</main>
      </body>
    </html>
  );
}