import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";
import { VIRTUOSO_GALLERY_ITEMS } from "@/lib/creator-onboard/virtuoso-gallery";

export const metadata: Metadata = {
  title: "VF Create · Virtuoso sponsored boots",
  description:
    "What Virtuoso sponsored boots are and a gallery of Virtuoso footwear from the Road to 1M challenge.",
  robots: { index: true, follow: true },
};

export default function VirtuosoGalleryPage() {
  return (
    <div className="relative min-h-dvh min-w-0 overflow-hidden">
      {/* Background: body's dark blue at top → soft white for the rest */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to bottom, rgba(248,250,252,0) 0px, rgba(248,250,252,0) 380px, rgba(248,250,252,0.85) 540px, #f8fafc 660px, #f8fafc 100%)",
        }}
      />
      {/* Subtle blue glow behind the hero text */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px]"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 60% at 50% 20%, rgba(120,160,255,0.18) 0%, rgba(120,160,255,0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 pt-4 pb-16 sm:px-6 lg:px-8">
        <div className="text-white">
          <SiteNav />

          <header className="mt-8 space-y-4 pb-8 sm:mt-10 sm:pb-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/55">
              VF Create
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
              Virtuoso sponsored boots
            </h1>
            <p className="max-w-3xl text-base leading-relaxed text-white/85 sm:text-[17px]">
              A Virtuoso sponsored boot is a pair of Virtuoso cleats that
              Virtual Football awards to top performers on the board — in past
              VF seasons, the best players have received pairs this way, and
              the same styles are also sold in-game where thousands of players
              buy Virtuoso boots to wear in matches.
            </p>
            <Link
              href="/content/creators#leaderboard"
              className="inline-flex w-fit text-sm font-semibold text-white/90 underline-offset-4 hover:text-white hover:underline"
            >
              ← Back to Road to 1M
            </Link>
          </header>
        </div>

        <div className="text-zinc-900">
          <section aria-label="Virtuoso boot gallery" className="space-y-6">
            <h2 className="text-lg font-semibold text-zinc-900">Gallery</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {VIRTUOSO_GALLERY_ITEMS.map((item) => (
                <li
                  key={item.num}
                  className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
                >
                  <figure className="flex flex-col">
                    <div className="relative aspect-[4/3] w-full bg-zinc-200">
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
                          alt={`Virtuoso boot reference ${item.num}`}
                          fill
                          sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <figcaption className="border-t border-zinc-100 px-3 py-2 text-center text-xs font-medium text-zinc-600">
                      #{item.num}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
