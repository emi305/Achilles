import type { ReactNode } from "react";

type AlertProps = {
  children: ReactNode;
  variant?: "error" | "info";
};

const alertStyles: Record<NonNullable<AlertProps["variant"]>, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  info: "border-stone-200 bg-stone-50 text-stone-700",
};

export function Alert({ children, variant = "error" }: AlertProps) {
  return <div className={`rounded-md border px-3 py-2 text-sm ${alertStyles[variant]}`}>{children}</div>;
}
