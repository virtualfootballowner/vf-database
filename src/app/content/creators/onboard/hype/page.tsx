import type { Metadata } from "next";
import Link from "next/link";

import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
import { isDiscordUserId } from "@/lib/creator-onboard/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VF Create Program · You’re in",
  description:
    "50,000 Robux prize pool and Custom VF Virtuoso Sponsorship. Start your VF Create application.",
  robots: { index: false, follow: false },
};

function pic(seed: string, w: number, h: number): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function PhotoSlot({
  label,
  className,
  aspectClass,
  previewSrc,
}: {
  label: string;
  aspectClass: string;
  className?: string;
  /** When set (e.g. `?preview=1`), shows a stock image so you can check layout without deploying assets. */
  previewSrc?: string | null;
}) {
  const filled = Boolean(previewSrc);
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-amber-500/25 bg-gradient-to-br from-orange-950/50 via-stone-950/80 to-black/90 shadow-[inset_0_1px_0_rgba(251,191,36,0.12)] ${aspectClass} ${className ?? ""}`}
    >
      {filled && previewSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- preview URLs only; final art will be local `Image` or static files */}
          <img
            src={previewSrc}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent"
          />
        </>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(251,146,60,0.35), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(220,38,38,0.18), transparent 50%)",
          }}
        />
      )}
      <div
        className={`relative z-[1] flex h-full min-h-[7rem] flex-col p-3 text-center sm:min-h-0 ${filled ? "items-stretch justify-end" : "items-center justify-center gap-2 p-4"}`}
      >
        {!filled ? (
          <span className="rounded-full border border-amber-400/30 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/90">
            Photo
          </span>
        ) : null}
        <p
          className={`text-[11px] font-medium leading-snug sm:text-xs ${filled ? "text-amber-50/95 drop-shadow-md" : "text-amber-100/55"}`}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

export default async function CreatorHypePage({
  searchParams,
}: {
  searchParams: Promise<{ discord_id?: string; preview?: string }>;
}) {
  const sp = await searchParams;
  const fromQuery = sp.discord_id?.trim() ?? "";
  const showPhotoPreview =
    sp.preview === "1" ||
    sp.preview === "true" ||
    sp.preview === "photos";

  let discordId: string | null = null;
  if (isDiscordUserId(fromQuery)) {
    discordId = fromQuery;
  } else {
    try {
      const { session } = await readCreatorSessionPayload();
      if (
        session?.expectedDiscordId &&
        isDiscordUserId(session.expectedDiscordId)
      ) {
        discordId = session.expectedDiscordId;
      }
    } catch {
      discordId = null;
    }
  }

  const bootstrapHref = discordId
    ? `/api/content/creators/bootstrap?discord_id=${encodeURIComponent(discordId)}`
    : null;

  const demo = showPhotoPreview
    ? {
        hero: pic("vfcreate-hero", 960, 540),
        g1: pic("vfcreate-g1", 640, 800),
        g2: pic("vfcreate-g2", 640, 640),
        g3: pic("vfcreate-g3", 640, 640),
        g4: pic("vfcreate-g4", 1280, 720),
        g5: pic("vfcreate-g5", 900, 600),
        g6: pic("vfcreate-g6", 900, 600),
        g7: pic("vfcreate-g7", 1400, 600),
        g8: pic("vfcreate-g8", 640, 640),
        g9: pic("vfcreate-g9", 640, 640),
        g10: pic("vfcreate-g10", 1200, 675),
        g11: pic("vfcreate-g11", 640, 640),
      }
    : null;

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-[#0a0604] text-amber-50">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 120% 80% at 50% -20%, rgba(234,88,12,0.28), transparent 45%), radial-gradient(ellipse 90% 60% at 100% 50%, rgba(185,28,28,0.12), transparent 50%), radial-gradient(ellipse 80% 50% at 0% 100%, rgba(245,158,11,0.08), transparent 45%), linear-gradient(180deg, #1c0a06 0%, #0a0604 38%, #050302 100%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col gap-10 px-4 pb-16 pt-10 sm:gap-14 sm:px-6 sm:pt-14 md:px-8">
        {showPhotoPreview ? (
          <p className="rounded-lg border border-amber-500/40 bg-black/50 px-3 py-2 text-center text-xs text-amber-200/90">
            <strong className="text-amber-100">Preview mode</strong> — layout
            check with stock images. Remove{' '}
            <code className="text-amber-50/90">?preview=1</code> for empty
            placeholders. Swap in real files under{' '}
            <code className="text-amber-50/90">public/vf-create/</code> when
            ready.
          </p>
        ) : null}
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-amber-200/70">
              VF Create Program
            </p>
            <h1 className="bg-gradient-to-b from-amber-50 via-amber-200 to-orange-400/90 bg-clip-text text-4xl font-black leading-[1.05] tracking-tight text-transparent sm:text-5xl md:text-6xl">
              This is your shot.
            </h1>
            <p className="text-lg font-medium leading-relaxed text-amber-100/85 sm:text-xl">
              We&apos;re building something loud for Virtual Football — and we want
              creators who can match the energy. You&apos;re not filling out a boring
              form. You&apos;re stepping into a program built around real rewards.
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-400/35 bg-orange-950/50 px-4 py-2 text-sm font-bold text-amber-100 shadow-[0_0_28px_-8px_rgba(251,146,60,0.55)]">
                <span
                  aria-hidden
                  className="size-2 rounded-full bg-amber-400 shadow-[0_0_12px_2px_rgba(251,191,36,0.9)]"
                />
                50,000 Robux prize pool
              </span>
              <span className="inline-flex items-center rounded-full border border-orange-500/30 bg-black/35 px-4 py-2 text-sm font-semibold text-amber-100/95">
                Custom VF Virtuoso Sponsorship
              </span>
            </div>
          </div>

          <div className="w-full shrink-0 md:max-w-md">
            <PhotoSlot
              label="Hero — your best clip, key art, or crowd moment (16×9)"
              aspectClass="aspect-video w-full"
              previewSrc={demo?.hero}
            />
          </div>
        </header>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-amber-50">
              Gallery — drop your fire here
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-amber-200/60">
              Staff can drop campaign shots, past challenge winners, and creator
              spotlights in these slots. You&apos;ll see this page evolve as the
              season heats up.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            <PhotoSlot
              label="VF matchday highlight"
              aspectClass="aspect-[4/5]"
              previewSrc={demo?.g1}
            />
            <PhotoSlot
              label="Creator spotlight"
              aspectClass="aspect-square"
              previewSrc={demo?.g2}
            />
            <PhotoSlot
              label="Community / reactions"
              aspectClass="aspect-square"
              previewSrc={demo?.g3}
            />
            <PhotoSlot
              label="Challenge announcement"
              aspectClass="aspect-video"
              className="col-span-2 sm:col-span-2 lg:col-span-2"
              previewSrc={demo?.g4}
            />
            <PhotoSlot
              label="Behind the scenes"
              aspectClass="aspect-[3/2]"
              previewSrc={demo?.g5}
            />
            <PhotoSlot
              label="Trophy moment"
              aspectClass="aspect-[3/2]"
              previewSrc={demo?.g6}
            />
            <PhotoSlot
              label="Full-width banner moment"
              aspectClass="aspect-[21/9]"
              className="col-span-2 sm:col-span-3 lg:col-span-4"
              previewSrc={demo?.g7}
            />
            <PhotoSlot
              label="Virtuoso feature still"
              aspectClass="aspect-square"
              previewSrc={demo?.g8}
            />
            <PhotoSlot
              label="Robux rewards graphic"
              aspectClass="aspect-square"
              previewSrc={demo?.g9}
            />
            <PhotoSlot
              label="Squad / team shoutout"
              aspectClass="aspect-video"
              className="col-span-2 sm:col-span-2"
              previewSrc={demo?.g10}
            />
            <PhotoSlot
              label="Season key art (square crop)"
              aspectClass="aspect-square"
              previewSrc={demo?.g11}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-orange-950/40 to-black/60 p-6 sm:p-8 shadow-[0_24px_80px_-32px_rgba(234,88,12,0.45)]">
          <h2 className="text-xl font-bold text-amber-50 sm:text-2xl">
            Ready when you are
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-amber-100/75">
            Next up: link Roblox and Discord, drop your details, and lock in the
            rules. Same Discord account as this link — we don&apos;t play mismatch
            games.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            {bootstrapHref ? (
              <Link
                href={bootstrapHref}
                className="inline-flex h-12 items-center justify-center rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-8 text-sm font-bold text-black shadow-[0_12px_40px_-12px_rgba(251,191,36,0.8)] transition hover:from-amber-400 hover:to-orange-500"
              >
                Start application
              </Link>
            ) : (
              <p className="text-sm text-amber-200/70">
                Open your personal link from the VF Discord bot (Start
                application) so we know it&apos;s you — then this button unlocks.
              </p>
            )}
            <Link
              href="/content/creators"
              className="text-center text-xs font-semibold uppercase tracking-wider text-amber-200/55 underline-offset-4 hover:text-amber-200 hover:underline sm:text-left"
            >
              VF Create directory
            </Link>
          </div>
        </section>

        <footer className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-amber-900/30 pt-8 text-center text-[11px] text-amber-200/45">
          <Link href="/privacy" className="underline underline-offset-2">
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <Link href="/terms" className="underline underline-offset-2">
            Terms
          </Link>
        </footer>
      </div>
    </main>
  );
}
