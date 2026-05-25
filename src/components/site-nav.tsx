"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type SiteNavKey = "tournament" | "stats" | "teams" | "players";

type SiteNavProps = {
  /** Highlighted link. Omit on the home page (logo is the home link). */
  active?: SiteNavKey;
};

const links: { href: string; label: string; key: SiteNavKey }[] = [
  { href: "/tournament", label: "Fixtures", key: "tournament" },
  { href: "/stats", label: "Stats", key: "stats" },
  { href: "/teams", label: "Teams", key: "teams" },
  { href: "/players", label: "Players", key: "players" },
];

export function SiteNav({ active }: SiteNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileCenterLabel = active
    ? (links.find((l) => l.key === active)?.label ?? "Menu")
    : "Home";

  return (
    <>
      <header className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-40 flex w-full max-w-full items-center gap-2 border-b border-white/10 bg-[#142952]/92 px-3 py-2.5 shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md md:top-[max(0.75rem,env(safe-area-inset-top))] md:w-fit md:max-w-none md:rounded-full md:border md:border-white/14 md:bg-white/[0.09] md:px-4 md:py-2 md:shadow-none md:backdrop-blur-[28px] md:backdrop-saturate-[160%]">
        <div className="flex min-w-0 flex-1 items-center gap-2 md:flex-initial md:gap-3">
          <Link href="/" className="flex shrink-0 items-center" aria-label="VF League home">
            <span
              className="font-display text-2xl leading-none tracking-[0.08em] text-white drop-shadow-[0_2px_12px_rgba(8,54,150,0.6)]"
            >
              VF
            </span>
          </Link>

          <p
            className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold tracking-wide text-white/90 md:hidden"
            aria-current={active ? "page" : undefined}
          >
            {mobileCenterLabel}
          </p>

          <span aria-hidden className="hidden h-4 w-px shrink-0 bg-white/15 md:block" />

          <nav
            aria-label="Primary"
            className="hidden items-center gap-0.5 text-sm font-medium text-white/75 md:flex"
          >
            {links.map((link) => {
              const isActive = link.key === active;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-full px-3 py-1.5 transition ${
                    isActive
                      ? "bg-white text-zinc-950"
                      : "hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0 text-white hover:bg-white/10 md:hidden"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          aria-controls="site-mobile-nav"
          onClick={() => setMenuOpen(true)}
        >
          <Menu className="size-5" />
        </Button>
      </header>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="right"
          id="site-mobile-nav"
          className="w-[min(100vw-0.5rem,20rem)] border-white/10 bg-[#0f1d3f] pb-[max(1rem,env(safe-area-inset-bottom))] text-white"
          showCloseButton
        >
          <SheetHeader className="border-b border-white/10 pb-4 text-left">
            <SheetTitle className="font-display text-xl tracking-wide text-white">
              VF League
            </SheetTitle>
          </SheetHeader>
          <nav aria-label="Mobile primary" className="mt-4 flex flex-col gap-1">
            {links.map((link) => {
              const isActive = link.key === active;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "rounded-xl px-4 py-3.5 text-base font-semibold transition active:scale-[0.99]",
                    isActive
                      ? "bg-white text-zinc-950"
                      : "text-white/90 hover:bg-white/10 hover:text-white",
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
