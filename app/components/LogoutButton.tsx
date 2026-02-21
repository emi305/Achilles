"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type LogoutButtonProps = {
  className?: string;
  label?: string;
};

export function LogoutButton({ className, label = "Log Out" }: LogoutButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          router.push("/");
          router.refresh();
          setBusy(false);
        }
      }}
      className={className}
    >
      {busy ? "Signing out..." : label}
    </button>
  );
}
