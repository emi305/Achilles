import type { ReactNode } from "react";

type CardProps = {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

export function Card({ title, description, children, className = "" }: CardProps) {
  return (
    <section className={`space-y-4 rounded-lg border border-stone-200 bg-white/95 p-6 shadow-sm ${className}`.trim()}>
      {title ? (
        <header className="space-y-1">
          <h2 className="brand-title text-lg font-semibold tracking-tight text-stone-900">{title}</h2>
          {description ? <p className="text-sm text-stone-600">{description}</p> : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}
