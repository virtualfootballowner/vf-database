import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

/** Files in `/public`: 1–17 (images + `1.mov`, `16.mp4`, `17.mov`; `3` is `3 (2).png`). */
function vfCreatePublicPath(num: number): string {
  const relative: Record<number, string> = {
    1: "/1.mov",
    2: "/2.png",
    3: "/3 (2).png",
    4: "/4.png",
    5: "/5.png",
    6: "/6.png",
    7: "/7.png",
    8: "/8.png",
    9: "/9.png",
    10: "/10.png",
    11: "/11.png",
    12: "/12.png",
    13: "/13.png",
    14: "/14.png",
    15: "/15.jpg",
    16: "/16.mp4",
    17: "/17.mov",
  };
  const path = relative[num];
  if (!path) throw new Error(`Missing VF Create asset mapping for ${num}`);
  return encodeURI(path);
}

function isVideoPath(path: string): boolean {
  return /\.(mov|mp4|webm)$/i.test(path.split("?")[0] ?? path);
}

function MediaSlot({
  src,
  label,
  className,
  aspectClass,
  priorityVideo,
}: {
  src: string;
  label: string;
  aspectClass: string;
  className?: string;
  /** Hero: stronger autoplay attributes. */
  priorityVideo?: boolean;
}) {
  const video = isVideoPath(src);
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/15 bg-[#12326e]/48 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${aspectClass} ${className ?? ""}`}
    >
      {video ? (
        <video
          src={src}
          className="absolute inset-0 size-full object-cover"
          muted
          playsInline
          loop
          autoPlay
          preload={priorityVideo ? "auto" : "metadata"}
          aria-label={label}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- static public assets */
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      )}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#041a45]/85 via-[#041a45]/20 to-transparent"
      />
      <div className="relative z-[1] flex h-full min-h-[4rem] flex-col justify-end p-3 text-center sm:min-h-0">
        <p className="text-[11px] font-medium leading-snug text-white/95 drop-shadow-md sm:text-xs">
          {label}
        </p>
      </div>
    </div>
  );
}

const GALLERY_LAYOUT: {
  n: number;
  aspectClass: string;
  className?: string;
}[] = [
  { n: 2, aspectClass: "aspect-[4/5]" },
  { n: 3, aspectClass: "aspect-square" },
  { n: 4, aspectClass: "aspect-square" },
  {
    n: 5,
    aspectClass: "aspect-video",
    className: "col-span-2 sm:col-span-2 lg:col-span-2",
  },
  { n: 6, aspectClass: "aspect-[3/2]" },
  { n: 7, aspectClass: "aspect-[3/2]" },
  {
    n: 8,
    aspectClass: "aspect-[21/9]",
    className: "col-span-2 sm:col-span-3 lg:col-span-4",
  },
  { n: 9, aspectClass: "aspect-square" },
  { n: 10, aspectClass: "aspect-square" },
  {
    n: 11,
    aspectClass: "aspect-video",
    className: "col-span-2 sm:col-span-2",
  },
  { n: 12, aspectClass: "aspect-square" },
  { n: 13, aspectClass: "aspect-[4/5]" },
  { n: 14, aspectClass: "aspect-square" },
  { n: 15, aspectClass: "aspect-video" },
  { n: 16, aspectClass: "aspect-square" },
  { n: 17, aspectClass: "aspect-video", className: "col-span-2" },
];

export function CreatorOnboardIntro({
  bootstrapHref,
}: {
  bootstrapHref: string | null;
}) {
  const heroSrc = vfCreatePublicPath(1);

  return (
    <main className="relative min-h-dvh min-w-0 overflow-x-hidden bg-[#04132f] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#083696]/95 via-[#061f52] to-[#040d22]"
      />
      <div className="relative mx-auto flex min-h-dvh max-w-6xl flex-col gap-8 px-4 pb-16 pt-5 sm:gap-10 sm:px-6 sm:pt-8 md:px-8 md:pt-10">
        <SiteNav />

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
          <MediaSlot
            src={heroSrc}
            label="VF Create · 1"
            aspectClass="aspect-video w-full"
            priorityVideo
          />
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-white">
              Gallery
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-white/55">
              VF Create and league moments — clips and stills from the team.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {GALLERY_LAYOUT.map(({ n, aspectClass, className }) => (
              <MediaSlot
                key={n}
                src={vfCreatePublicPath(n)}
                label={`VF Create · ${n}`}
                aspectClass={aspectClass}
                className={className}
              />
            ))}
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
