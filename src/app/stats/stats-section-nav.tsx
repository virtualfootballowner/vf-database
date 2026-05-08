"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs: { href: string; label: string }[] = [
  { href: "/stats", label: "Leaders" },
  { href: "/stats/matches", label: "All matches" },
  { href: "/stats/tournaments", label: "Tournaments" },
  { href: "/stats/faceit", label: "FACEIT" },
];

export function StatsSectionNav() {
  const pathname = usePathname();

  const isActive = (href: string): boolean => {
    if (href === "/stats") return pathname === "/stats" || pathname === "/stats/";
    if (href === "/stats/matches") {
      return (
        pathname === "/stats/matches" ||
        /^\/stats\/matches\/.+/.test(pathname)
      );
    }
    if (href === "/stats/tournaments") {
      return (
        pathname === "/stats/tournaments" ||
        pathname === "/stats/tournaments/"
      );
    }
    if (href === "/stats/faceit") {
      return (
        pathname === "/stats/faceit" ||
        /^\/stats\/faceit\/.+/.test(pathname)
      );
    }
    return false;
  };

  return (
    <div className="w-full overflow-x-auto overflow-y-visible overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <nav
        aria-label="Stats sections"
        className="inline-flex w-max min-w-0 flex-nowrap gap-1 rounded-full border border-white/10 bg-white/5 p-1"
      >
        {tabs.map((tab) => {
          const active = isActive(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 rounded-full px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition sm:px-4 sm:text-xs sm:tracking-[0.14em] ${
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
    </div>
  );
}
