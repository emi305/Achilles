import type { ReactNode } from "react";

type AlertProps = {
  children: ReactNode;
  variant?: "error" | "info";
};

const alertStyles: Record<NonNullable<AlertProps["variant"]>, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

export function Alert({ children, variant = "error" }: AlertProps) {
  return <div className={`rounded-md border px-3 py-2 text-sm ${alertStyles[variant]}`}>{children}</div>;
}
