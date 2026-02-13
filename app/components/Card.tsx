import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, description, children, className = "" }: CardProps) {
  return (
    <section className={`space-y-4 rounded-lg border border-slate-200 bg-white p-6 ${className}`.trim()}>
      {title ? (
        <header className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? <p className="text-sm text-slate-600">{description}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
