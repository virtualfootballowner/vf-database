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
  title: "VF Creators",
  description:
    "Official Virtual Football creator program members — discover who’s creating with VF.",
  robots: { index: false, follow: false },
};

function countryLabel(code: string | null): string | null {
  if (!code?.trim()) return null;
  const hit = COUNTRIES.find((c) => c.code === code.toUpperCase().trim());
  return hit?.name ?? code;
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
          VF Creator Program
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Creators
        </h1>
        <p className="text-muted-foreground max-w-xl text-sm leading-relaxed">
          People approved for the VF creator program. This page isn’t linked from
          the main site menu — share the URL if you want someone to find it.
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
