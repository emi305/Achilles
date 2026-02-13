import Link from "next/link";
import type { ReactNode } from "react";

type GreekFrameProps = {
  children: ReactNode;
};

export function GreekFrame({ children }: GreekFrameProps) {
  return (
    <div className="greek-shell min-h-screen">
      <div aria-hidden className="greek-column greek-column-left" />
      <div aria-hidden className="greek-column greek-column-right" />

      <div className="settings-link-wrap">
        <Link href="/settings" className="settings-link">
          Settings
        </Link>
      </div>

      <main className="greek-main">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
