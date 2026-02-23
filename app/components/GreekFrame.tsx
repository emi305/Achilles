import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

type GreekFrameProps = {
  children: ReactNode;
};

export function GreekFrame({ children }: GreekFrameProps) {
  return (
    <div className="greek-shell min-h-screen">
      <div aria-hidden className="greek-column greek-column-left" />
      <div aria-hidden className="greek-column greek-column-right" />

      <div className="settings-link-wrap settings-link-wrap-left">
        <div className="settings-link-stack items-start">
          <Link href="/" className="settings-link">
            Home
          </Link>
          <Link href="/legal" className="settings-link">
            Legal
          </Link>
        </div>
      </div>

      <div className="settings-link-wrap">
        <div className="settings-link-stack">
          <Link href="/settings" className="settings-link">
            Settings
          </Link>
          <LogoutButton className="settings-link" />
        </div>
      </div>

      <main className="greek-main">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
