import {
  ArrowRight,
  ChevronDown,
  PlayCircle,
  Trophy,
  User,
  Users,
} from "lucide-react";
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

const FEATURED_VIDEOS: {
  id: string;
  url: string;
  title: string;
  start?: number;
}[] = [
  {
    id: "vNjCXyumZmI",
    url: "https://www.youtube.com/watch?v=vNjCXyumZmI",
    title: "Virtual Football · Featured",
  },
  {
    id: "0B4S-RyiTCw",
    url: "https://www.youtube.com/watch?v=0B4S-RyiTCw",
    title: "Virtual Football · Match",
  },
  {
    id: "qeMCZqOhXsM",
    url: "https://www.youtube.com/watch?v=qeMCZqOhXsM&t=2s",
    title: "Virtual Football · Highlights",
    start: 2,
  },
];

const SOCIAL_LINKS = {
  youtube: "https://www.youtube.com/@VirtualFootballOfficial",
  roblox: "https://www.roblox.com/communities/16822286/VirtualFootball",
};

export default function Home() {
  return (
    <>
      <main className="relative min-h-dvh min-w-0 w-full overflow-x-clip text-white">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 pb-16 pt-5 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
          <SiteNav />

          <section className="relative grid items-center gap-8 pt-2 sm:gap-10 sm:pt-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-2 lg:pt-24">
            <div className="relative z-10 order-1 min-w-0 lg:order-1">
              <h1 className="text-shadow-glass relative z-10 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-5xl sm:leading-[1.05] lg:max-w-[155%] xl:text-6xl">
                The home of every player,
                <br />
                team & season
                <br />
                in the <span className="glisten">league</span>.
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-7 text-white/75 sm:mt-5 sm:text-lg">
                A display layer for the VF database. Browse teams, scout
                players, and revisit every season.
              </p>

              <a
                href="#explore"
                className="group relative z-10 mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/85 backdrop-blur transition hover:border-white/40 hover:bg-white/10 hover:text-white sm:mt-8 sm:text-xs sm:tracking-[0.2em]"
              >
                Scroll to explore
                <ChevronDown className="size-3.5 transition group-hover:translate-y-0.5" />
              </a>
            </div>

            <div className="relative order-2 mx-auto w-full max-w-[min(100%,26rem)] min-h-0 sm:max-w-xl md:max-w-2xl lg:order-2 lg:mx-0 lg:-mb-44 lg:-ml-20 lg:max-w-none xl:-mb-56">
              <Image
                src="/VF LANDING.png"
                alt="VF League players"
                width={1024}
                height={788}
                priority
                sizes="(min-width: 1024px) 40vw, (min-width: 640px) 85vw, 100vw"
                className="h-auto w-full max-w-full origin-bottom scale-100 sm:scale-105 lg:scale-150"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 58%, rgba(0,0,0,0.82) 80%, transparent 100%)",
                  maskImage:
                    "linear-gradient(to bottom, #000 58%, rgba(0,0,0,0.82) 80%, transparent 100%)",
                }}
              />
            </div>
          </section>
        </div>
      </main>

      <div
        aria-hidden
        className="pointer-events-none h-56 w-full sm:h-72 lg:h-80"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(255,255,255,0) 0%, rgba(255,255,255,0.55) 55%, #ffffff 100%)",
        }}
      />

      <section
        id="explore"
        className="relative -mt-px w-full bg-white text-zinc-900"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-5 pb-24 pt-10 sm:gap-16 sm:px-6 sm:pt-14 md:px-8 md:pt-16">
          <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex max-w-3xl flex-col gap-3">
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
            </div>
            <div className="flex flex-wrap gap-2.5">
              <a
                href={SOCIAL_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-[#ff0033] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#e6002e]"
              >
                <Youtube className="size-4" />
                YouTube channel
              </a>
              <a
                href={SOCIAL_LINKS.roblox}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
              >
                <RobloxMark className="size-4" />
                Roblox group
              </a>
            </div>
          </header>

          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                  Latest from the channel
                </p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                  Watch the league
                </h3>
              </div>
              <a
                href={SOCIAL_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition hover:text-zinc-950"
              >
                See all videos
                <ArrowRight className="size-4" />
              </a>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {FEATURED_VIDEOS.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                Database
              </p>
              <h3 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                Jump in
              </h3>
            </div>
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
                      <h4 className="text-xl font-semibold tracking-tight text-zinc-950">
                        {link.label}
                      </h4>
                      <p className="mt-1.5 text-sm leading-6 text-zinc-600">
                        {link.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
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
            <div className="flex flex-col gap-3 rounded-2xl bg-white/60 p-5 ring-1 ring-zinc-200">
              <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-500">
                Join us
              </p>
              <a
                href={SOCIAL_LINKS.roblox}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-zinc-950 text-white">
                    <RobloxMark className="size-4" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-zinc-950">
                      VirtualFootball
                    </p>
                    <p className="text-xs text-zinc-500">
                      Roblox community
                    </p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700" />
              </a>
              <a
                href={SOCIAL_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition hover:border-zinc-300 hover:bg-zinc-50"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#ff0033] text-white">
                    <Youtube className="size-4" />
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-semibold text-zinc-950">
                      @VirtualFootballOfficial
                    </p>
                    <p className="text-xs text-zinc-500">YouTube channel</p>
                  </div>
                </div>
                <ArrowRight className="size-4 text-zinc-400 transition group-hover:translate-x-0.5 group-hover:text-zinc-700" />
              </a>
            </div>
          </div>

          <footer className="flex flex-col items-start gap-4 border-t border-zinc-200 pt-8 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[100%]">VF League Database · A display layer for the VF database.</p>
            <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 sm:w-auto sm:justify-end">
              <Link
                href="/content/creators/onboard"
                className="transition hover:text-zinc-950"
              >
                VF Create onboarding
              </Link>
              <a
                href={SOCIAL_LINKS.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:text-zinc-950"
              >
                <Youtube className="size-3.5" />
                YouTube
              </a>
              <a
                href={SOCIAL_LINKS.roblox}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 transition hover:text-zinc-950"
              >
                <RobloxMark className="size-3.5" />
                Roblox
              </a>
              <span className="font-mono uppercase tracking-[0.2em]">
                myvirtualfootball.com
              </span>
            </div>
          </footer>
        </div>
      </section>
    </>
  );
}

function VideoCard({
  video,
}: {
  video: { id: string; url: string; title: string; start?: number };
}) {
  const embedSrc = `https://www.youtube-nocookie.com/embed/${video.id}${
    video.start ? `?start=${video.start}` : ""
  }`;
  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md">
      <div className="relative aspect-video w-full overflow-hidden bg-zinc-100">
        <iframe
          src={embedSrc}
          title={video.title}
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <PlayCircle className="size-4 shrink-0 text-[#ff0033]" />
          <p className="truncate text-sm font-semibold text-zinc-950">
            {video.title}
          </p>
        </div>
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-xs font-semibold text-zinc-600 transition hover:text-zinc-950"
        >
          Watch ↗
        </a>
      </div>
    </div>
  );
}

function RobloxMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      fillRule="evenodd"
      className={className}
    >
      <path d="M4.55 2.6 21.55 6.05 18.1 23.05 1.1 19.6 4.55 2.6zM9.65 10.1 15.65 11.32 14.42 17.32 8.42 16.1 9.65 10.1z" />
    </svg>
  );
}

function Youtube({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="currentColor"
      className={className}
    >
      <path d="M23.5 6.2a3 3 0 0 0-2.1-2.12C19.55 3.5 12 3.5 12 3.5s-7.55 0-9.4.58A3 3 0 0 0 .5 6.2C0 8.05 0 12 0 12s0 3.95.5 5.8a3 3 0 0 0 2.1 2.12c1.85.58 9.4.58 9.4.58s7.55 0 9.4-.58a3 3 0 0 0 2.1-2.12C24 15.95 24 12 24 12s0-3.95-.5-5.8zM9.6 15.6V8.4L15.84 12 9.6 15.6z" />
    </svg>
  );
}
