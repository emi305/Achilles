import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cinzel, Lora } from "next/font/google";
import { GreekFrame } from "./components/GreekFrame";
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
        <GreekFrame>{children}</GreekFrame>
      </body>
    </html>
  );
}
