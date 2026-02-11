import Link from "next/link";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/upload", label: "Upload" },
  { href: "/results", label: "Results" },
];

export function TopNav() {
  return (
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-4xl items-center gap-6 px-6 py-4">
        <span className="text-sm font-semibold text-slate-900">Achilles Insight</span>
        <ul className="flex items-center gap-4 text-sm text-slate-700">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link className="transition hover:text-slate-900" href={item.href}>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
