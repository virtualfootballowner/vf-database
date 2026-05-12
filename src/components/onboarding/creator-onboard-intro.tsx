import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

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
  previewSrc?: string | null;
}) {
  const filled = Boolean(previewSrc);
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-white/15 bg-[#12326e]/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${aspectClass} ${className ?? ""}`}
    >
      {filled && previewSrc ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- preview URLs only */}
          <img
            src={previewSrc}
            alt=""
            className="absolute inset-0 size-full object-cover"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041a45]/90 via-[#041a45]/30 to-transparent"
          />
        </>
      ) : (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(59,130,246,0.25), transparent 55%), radial-gradient(ellipse 70% 50% at 80% 80%, rgba(8,54,150,0.35), transparent 50%)",
          }}
        />
      )}
      <div
        className={`relative z-[1] flex h-full min-h-[7rem] flex-col p-3 text-center sm:min-h-0 ${filled ? "items-stretch justify-end" : "items-center justify-center gap-2 p-4"}`}
      >
        {!filled ? (
          <span className="rounded-full border border-white/20 bg-black/30 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/70">
            Photo
          </span>
        ) : null}
        <p
          className={`text-[11px] font-medium leading-snug sm:text-xs ${filled ? "text-white/95 drop-shadow-md" : "text-white/55"}`}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

export function CreatorOnboardIntro({
  bootstrapHref,
  showPhotoPreview,
}: {
  bootstrapHref: string | null;
  showPhotoPreview: boolean;
}) {
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
    <main className="relative min-h-dvh min-w-0 overflow-x-hidden bg-[#04132f] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#083696]/95 via-[#061f52] to-[#040d22]"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:gap-10 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav />

        {showPhotoPreview ? (
          <p className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-center text-xs text-white/80">
            <strong className="text-white">Preview mode</strong> — stock images.
            Remove <code className="text-white/90">?preview=1</code> for empty
            placeholders.
          </p>
        ) : null}

        {/* Above the fold: headline, rewards, CTA */}
        <header className="flex flex-col gap-6">
          <div className="space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              VF Create Program
            </p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              This is your shot.
            </h1>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/20 bg-white/[0.07] px-5 py-6 shadow-[0_20px_60px_-24px_rgba(8,54,150,0.65)] sm:py-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">
                Prize pool
              </p>
              <p className="mt-2 text-4xl font-black tabular-nums tracking-tight sm:text-5xl md:text-6xl">
                50K
              </p>
              <p className="mt-1 text-lg font-semibold text-white sm:text-xl">
                Robux on the line
              </p>
              <p className="mt-2 text-sm text-white/65">
                Real competition rewards for VF Create creators.
              </p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/[0.07] px-5 py-6 shadow-[0_20px_60px_-24px_rgba(8,54,150,0.65)] sm:py-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/90">
                Sponsorship
              </p>
              <p className="mt-3 text-2xl font-bold leading-tight sm:text-3xl md:text-4xl">
                Custom VF Virtuoso Sponsorship
              </p>
              <p className="mt-3 text-sm text-white/65">
                Partner-tier visibility with Virtual Football — tailored for
                standout creators.
              </p>
            </div>
          </div>

          <p className="max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
            We&apos;re building something loud for Virtual Football — and we want
            creators who can match the energy.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            {bootstrapHref ? (
              <Link
                href={bootstrapHref}
                className="inline-flex h-14 min-h-[3.5rem] items-center justify-center rounded-lg bg-white px-8 text-base font-bold text-[#083696] shadow-[0_16px_48px_-12px_rgba(255,255,255,0.35)] transition hover:bg-white/90"
              >
                Start application
              </Link>
            ) : (
              <p className="text-sm text-white/70">
                Use your personal link from the VF Discord bot (Start
                application) so we can unlock this button for your account.
              </p>
            )}
            <Link
              href="/content/creators"
              className="text-center text-xs font-semibold uppercase tracking-wider text-white/55 underline-offset-4 hover:text-white hover:underline sm:text-left"
            >
              VF Create directory
            </Link>
          </div>

          <p className="text-xs text-white/50">
            Next: link Roblox and Discord, your details, then program rules —
            same Discord as this link.
          </p>
        </header>

        <div className="w-full">
          <PhotoSlot
            label="Hero — your best clip, key art, or crowd moment (16×9)"
            aspectClass="aspect-video w-full"
            previewSrc={demo?.hero}
          />
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Gallery
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              Spots for campaign shots, winners, and spotlights as the season
              ramps up.
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

        <footer className="mt-auto flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-white/10 pt-8 text-center text-[11px] text-white/45">
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
