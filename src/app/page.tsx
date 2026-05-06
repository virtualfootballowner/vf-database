import { ArrowRight, ChevronDown, Trophy, Users, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

const QUICK_LINKS = [
  {
    href: "/teams",
    label: "Teams",
    description: "Crests, squads, and season records for every club.",
    icon: Users,
  },
  {
    href: "/players",
    label: "Players",
    description: "Profiles, careers, trophies, and personal accolades.",
    icon: User,
  },
  {
    href: "/stats",
    label: "Stats",
    description: "Leaders, fixtures, tournaments, and FACEIT scrimmages.",
    icon: Trophy,
  },
] as const;

export default function Home() {
  return (
    <>
      <main className="relative min-h-screen w-full overflow-hidden text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
          <SiteNav />

          <section className="relative grid items-center gap-4 pt-12 sm:pt-20 lg:grid-cols-[1.15fr_0.85fr] lg:gap-2 lg:pt-24">
            <div className="relative">
              <h1 className="text-shadow-glass relative z-10 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:max-w-[155%]">
                The home of every player,
                <br />
                team & season
                <br />
                in the <span className="glisten">league</span>.
              </h1>
              <p className="mt-5 max-w-sm text-base leading-7 text-white/75 sm:text-lg">
                A display layer for the VF database. Browse teams, scout
                players, and revisit every season.
              </p>

              <a
                href="#explore"
                className="group relative z-10 mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/85 backdrop-blur transition hover:border-white/40 hover:bg-white/10 hover:text-white"
              >
                Scroll to explore
                <ChevronDown className="size-3.5 transition group-hover:translate-y-0.5" />
              </a>
            </div>

            <div className="relative -mb-32 sm:-mb-44 lg:-ml-20 lg:-mb-56">
              <Image
                src="/VF LANDING.png"
                alt="VF League players"
                width={1024}
                height={788}
                priority
                sizes="(min-width: 1024px) 75vw, 100vw"
                className="h-auto w-full origin-bottom scale-150"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 50%, rgba(0,0,0,0.6) 75%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to bottom, #000 50%, rgba(0,0,0,0.6) 75%, transparent 100%)",
                }}
              />
            </div>
          </section>
        </div>
      </main>

      <section
        id="explore"
        className="relative w-full bg-white text-zinc-900"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 pb-24 pt-20 sm:px-8 sm:pt-24">
          <header className="flex max-w-3xl flex-col gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
              The VF league
            </p>
            <h2 className="text-3xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-5xl">
              Everything from the league, in one place.
            </h2>
            <p className="max-w-xl text-base leading-7 text-zinc-600">
              Teams, players, season tables, knockout brackets, and live
              scrimmage data — all kept in sync with the VF database.
            </p>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[#083696]/10 text-[#083696] ring-1 ring-[#083696]/15">
                      <Icon className="size-5" />
                    </span>
                    <ArrowRight className="size-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold tracking-tight text-zinc-950">
                      {link.label}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                      {link.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="grid gap-4 rounded-3xl border border-zinc-200 bg-zinc-50 p-6 sm:p-10 lg:grid-cols-[1.4fr_1fr] lg:items-center">
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                Season 3
              </p>
              <h3 className="text-2xl font-semibold leading-tight tracking-tight text-zinc-950 sm:text-3xl">
                The World Cup is coming.
              </h3>
              <p className="max-w-xl text-sm leading-6 text-zinc-600">
                Qualified nations are locked in — pots and groups will fill in
                the moment the draw is made. Track the road to the final from
                the Fixtures page.
              </p>
              <div>
                <Link
                  href="/tournament"
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#083696] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0a44b8]"
                >
                  View fixtures
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-3">
              <Stat label="Teams" href="/teams" />
              <Stat label="Players" href="/players" />
              <Stat label="Stats" href="/stats" />
            </div>
          </div>

          <footer className="flex flex-col items-start gap-2 border-t border-zinc-200 pt-8 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p>VF League Database · A display layer for the VF database.</p>
            <p className="font-mono uppercase tracking-[0.2em]">myvirtualfootball.com</p>
          </footer>
        </div>
      </section>
    </>
  );
}

function Stat({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-0.5 rounded-2xl border border-transparent bg-white px-3 py-4 text-zinc-700 shadow-sm transition hover:border-zinc-200 hover:text-zinc-950"
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Browse
      </span>
      <span className="text-sm font-semibold tracking-tight">{label}</span>
    </Link>
  );
}
