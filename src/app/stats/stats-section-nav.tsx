"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs: { href: string; label: string }[] = [
  { href: "/stats", label: "Leaders" },
  { href: "/stats/matches", label: "All matches" },
  { href: "/stats/tournaments", label: "Tournaments" },
];

export function StatsSectionNav() {
  const pathname = usePathname();
  const leadersActive = pathname === "/stats" || pathname === "/stats/";
  const matchesActive =
    pathname === "/stats/matches" ||
    /^\/stats\/matches\/.+/.test(pathname);
  const tournamentsActive =
    pathname === "/stats/tournaments" ||
    pathname === "/stats/tournaments/";

  return (
    <nav
      aria-label="Stats sections"
      className="inline-flex flex-wrap gap-1 rounded-full border border-white/10 bg-white/5 p-1"
    >
      {tabs.map((tab) => {
        const active =
          tab.href === "/stats"
            ? leadersActive
            : tab.href === "/stats/matches"
              ? matchesActive
              : tournamentsActive;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition ${
              active
                ? "bg-white text-zinc-950 shadow-[0_4px_16px_-4px_rgba(255,255,255,0.35)]"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
