import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { VF_BRAND_GALLERY_ITEMS } from "@/lib/creator-onboard/vf-brand-gallery";

export const metadata: Metadata = {
  title: "VF Create · VF Brand Gallery",
  description:
    "What VF Brand sponsored boots are, with a gallery of past VF Brand footwear awarded through the Road to 1M challenge.",
  robots: { index: true, follow: true },
};

export default function VfBrandGalleryPage() {
  return (
    <div className="relative min-h-dvh min-w-0 overflow-hidden text-white">
      {/* Hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[520px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 50% 18%, rgba(140,180,255,0.22) 0%, rgba(140,180,255,0) 70%)",
        }}
      />
      {/* Mid-page accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-[640px] h-[760px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 55% 45% at 18% 30%, rgba(70,120,220,0.22) 0%, rgba(70,120,220,0) 70%), radial-gradient(ellipse 55% 50% at 85% 75%, rgba(140,90,230,0.18) 0%, rgba(140,90,230,0) 70%)",
        }}
      />
      {/* Lower warm accent */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[700px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 60% at 50% 100%, rgba(255,140,80,0.10) 0%, rgba(255,140,80,0) 60%), radial-gradient(ellipse 50% 40% at 80% 95%, rgba(80,160,255,0.14) 0%, rgba(80,160,255,0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6 lg:px-8">
        <SiteNav />

        <header className="mt-8 space-y-4 pb-8 sm:mt-10 sm:pb-12">
          <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
            VF Create
          </p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            VF Brand Gallery
          </h1>
          <p className="max-w-3xl text-base leading-relaxed text-white/85 sm:text-[17px]">
            A VF Brand sponsored boot is a pair of in-game cleats that Virtual
            Football awards to top performers on the board — in past VF
            seasons, the best players have received pairs this way, and the
            same styles are also sold in-game where thousands of players buy
            VF Brand boots to wear in matches.
          </p>
          <Link
            href="/content/creators#leaderboard"
            className="inline-flex w-fit text-sm font-semibold text-blue-200 underline-offset-4 hover:text-white hover:underline"
          >
            ← Back to Road to 1M
          </Link>
        </header>

        <section aria-label="VF Brand sponsored gear gallery" className="space-y-6">
          <div className="flex items-end justify-between border-b border-white/15 pb-3">
            <h2 className="text-lg font-semibold text-white sm:text-xl">
              Gallery
            </h2>
            <p className="text-xs text-white/55">
              {VF_BRAND_GALLERY_ITEMS.length} references
            </p>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {VF_BRAND_GALLERY_ITEMS.map((item) => (
              <li
                key={item.num}
                className="overflow-hidden rounded-xl border border-white/15 bg-white/[0.06] shadow-[0_20px_45px_-25px_rgba(0,0,0,0.6)] backdrop-blur transition hover:border-white/25 hover:bg-white/[0.09]"
              >
                <figure className="flex flex-col">
                  <div className="relative aspect-[4/3] w-full bg-black/30">
                    {item.kind === "video" ? (
                      <video
                        src={item.src}
                        controls
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : (
                      <Image
                        src={item.src}
                        alt={`VF Brand reference ${item.num}`}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <figcaption className="border-t border-white/10 px-3 py-2 text-center text-xs font-medium text-white/70">
                    #{item.num}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
