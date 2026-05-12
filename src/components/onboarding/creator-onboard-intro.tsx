import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

const ROBUX_LOGO_SRC = "/Robux_2019_Logo_Black.svg.png";

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

/** Full media visible inside frame (`object-contain`); letterboxing fills with dark blue. */
function MediaSlot({
  src,
  className,
  aspectClass,
  priorityVideo,
}: {
  src: string;
  aspectClass: string;
  className?: string;
  priorityVideo?: boolean;
}) {
  const video = isVideoPath(src);
  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-[#0a1629] ${aspectClass} ${className ?? ""}`}
    >
      {video ? (
        <video
          src={src}
          className="absolute inset-0 size-full object-contain"
          muted
          playsInline
          loop
          autoPlay
          preload={priorityVideo ? "auto" : "metadata"}
          aria-label="Clip"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element -- static public assets */
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-contain"
        />
      )}
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

        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:gap-5">
          <div className="flex w-full max-w-md items-center justify-center rounded-lg bg-white px-5 py-3 sm:w-auto sm:justify-start">
            {/* eslint-disable-next-line @next/next/no-img-element -- static public asset */}
            <img
              src={ROBUX_LOGO_SRC}
              alt="Robux"
              width={280}
              height={80}
              className="h-9 w-auto max-w-full object-contain object-left sm:h-10"
            />
          </div>
          <p className="max-w-md text-center text-sm leading-snug text-white/65 sm:text-left">
            Backed by a real <span className="text-white">50K Robux</span> pool
            for VF Create creators.
          </p>
        </div>

        <header className="flex flex-col gap-6">
          <div className="space-y-2">
            <p className="text-sm text-white/50">VF Create Program</p>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl md:text-6xl">
              This is your shot.
            </h1>
          </div>

          <div className="grid gap-8 border-t border-white/10 pt-8 sm:grid-cols-2 sm:gap-12">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm text-white/50">Prize pool</p>
                <div className="rounded bg-white px-1.5 py-0.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ROBUX_LOGO_SRC}
                    alt=""
                    width={72}
                    height={22}
                    className="h-3.5 w-auto object-contain"
                  />
                </div>
              </div>
              <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight sm:text-5xl">
                50K
              </p>
              <p className="mt-1 text-lg text-white/90">Robux on the line</p>
              <p className="mt-2 text-sm text-white/55">
                Competition rewards for VF Create creators.
              </p>
            </div>
            <div className="sm:border-l sm:border-white/10 sm:pl-12">
              <p className="text-sm text-white/50">Sponsorship</p>
              <p className="mt-3 text-xl font-semibold leading-snug sm:text-2xl">
                Custom VF Virtuoso Sponsorship
              </p>
              <p className="mt-3 text-sm text-white/55 leading-relaxed">
                Visibility with Virtual Football for standout creators.
              </p>
            </div>
          </div>

          <p className="max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
            We&apos;re building something loud for Virtual Football — and we want
            creators who can match the energy.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center">
            {bootstrapHref ? (
              <Link
                href={bootstrapHref}
                className="inline-flex min-h-[3.75rem] items-center justify-center rounded-md bg-white px-12 py-4 text-lg font-semibold text-[#083696] transition-colors hover:bg-neutral-100"
              >
                Start application
              </Link>
            ) : (
              <p className="text-sm text-white/65">
                Use your personal link from the VF Discord bot (Start
                application) so we can unlock this button for your account.
              </p>
            )}
            <Link
              href="/content/creators"
              className="text-sm text-white/50 underline underline-offset-4 hover:text-white"
            >
              VF Create directory
            </Link>
          </div>

          <p className="text-xs text-white/45">
            Next: Roblox, Discord, your details, then rules — same Discord as
            this link.
          </p>
        </header>

        <div className="w-full">
          <MediaSlot
            src={heroSrc}
            aspectClass="aspect-video w-full"
            priorityVideo
          />
        </div>

        <section className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Gallery</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/50">
              VF Create and league moments.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
            {GALLERY_LAYOUT.map(({ n, aspectClass, className }) => (
              <MediaSlot
                key={n}
                src={vfCreatePublicPath(n)}
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
