import type { Metadata } from "next";
import Link from "next/link";

import {
  listApprovedCreatorsForDirectory,
  type ApprovedCreatorDirectoryRow,
} from "@/lib/creator-onboard/approved-creators-directory";
import { COUNTRIES } from "@/lib/creator-onboard/countries";
import { loadCreatorWebEnv } from "@/lib/creator-onboard/env-web";
import { stripAtHandle } from "@/lib/creator-onboard/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VF Create · Creators",
  description:
    "Official Virtual Football creator program members — discover who’s creating with VF.",
  robots: { index: false, follow: false },
};

function countryLabel(code: string | null): string | null {
  if (!code?.trim()) return null;
  const hit = COUNTRIES.find((c) => c.code === code.toUpperCase().trim());
  return hit?.name ?? code;
}

function postHostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Link";
  }
}

function formatPostedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function CreatorsDirectoryPage() {
  let creators: ApprovedCreatorDirectoryRow[] = [];
  try {
    const env = loadCreatorWebEnv();
    creators = await listApprovedCreatorsForDirectory(env);
  } catch {
    creators = [];
  }

  return (
    <main className="mx-auto flex min-h-dvh min-w-0 max-w-3xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-14">
      <header className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          VF Create Program
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Creators
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          Approved VF Create members and the posts they add from Discord{" "}
          <span className="text-foreground/80 font-mono text-xs">/posted</span>.
          Competition scoring comes later — this is the public post log.
        </p>
      </header>

      {creators.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No published creators yet. Check back after the next approvals.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {creators.map((c) => {
            const display =
              c.discord_username?.trim() || c.roblox_username || "Creator";
            const tt = stripAtHandle(c.tiktok_handle);
            const yt = stripAtHandle(c.youtube_handle);
            const country = countryLabel(c.country);
            const posts = [...(c.posted_video_links ?? [])].sort(
              (a, b) =>
                new Date(b.posted_at).getTime() -
                new Date(a.posted_at).getTime(),
            );
            return (
              <li
                key={c.id}
                className="border-border bg-card/30 flex gap-4 rounded-xl border p-4 sm:gap-5 sm:p-5"
              >
                {c.roblox_avatar_url ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={c.roblox_avatar_url}
                    alt=""
                    width={56}
                    height={56}
                    className="size-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="bg-muted text-muted-foreground flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold">
                    {display.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-foreground font-medium leading-snug">
                    {display}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Roblox:{" "}
                    <span className="text-foreground/90">{c.roblox_username}</span>
                    {country ? (
                      <>
                        {" · "}
                        {country}
                      </>
                    ) : null}
                  </p>
                  <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 pt-1 text-sm">
                    {tt ? (
                      <a
                        href={`https://www.tiktok.com/@${encodeURIComponent(tt)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        TikTok
                      </a>
                    ) : null}
                    {yt ? (
                      <a
                        href={`https://www.youtube.com/@${encodeURIComponent(yt)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        YouTube
                      </a>
                    ) : null}
                    {!tt && !yt ? (
                      <span className="text-muted-foreground/80">—</span>
                    ) : null}
                  </div>
                  {posts.length > 0 ? (
                    <div className="border-border/80 mt-3 border-t pt-3">
                      <p className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
                        Posted
                      </p>
                      <ul className="flex list-none flex-col gap-1.5 text-sm">
                        {posts.map((p) => {
                          const dateLabel = formatPostedDate(p.posted_at);
                          return (
                            <li key={`${c.id}-${p.posted_at}-${p.url}`}>
                              <a
                                href={p.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-primary inline-flex flex-wrap items-baseline gap-x-2 underline-offset-2 hover:underline"
                              >
                                <span className="font-medium">
                                  {postHostLabel(p.url)}
                                </span>
                                {dateLabel ? (
                                  <span className="text-muted-foreground text-xs font-normal tabular-nums">
                                    {dateLabel}
                                  </span>
                                ) : null}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="text-muted-foreground border-border mt-auto space-y-3 border-t pt-8 text-center text-xs sm:text-sm">
        <p>
          <Link href="/" className="underline underline-offset-2">
            VF home
          </Link>
          {" · "}
          <Link
            href="/content/creators/onboard"
            className="underline underline-offset-2"
          >
            Creator onboarding
          </Link>{" "}
          (you’ll need a personal link from Discord)
        </p>
      </footer>
    </main>
  );
}
