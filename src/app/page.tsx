import Image from "next/image";

import { SiteNav } from "@/components/site-nav";

export default function Home() {
  return (
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
  );
}
