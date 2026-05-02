import type { Metadata } from "next";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Terms of Service · VF League",
  description:
    "Terms of Service for the VF League (Virtual Football League) website and verification tools.",
};

export default function TermsPage() {
  return (
    <main className="relative min-h-screen w-full text-white">
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <SiteNav active="home" />
        <article className="mt-10 space-y-6 text-sm leading-relaxed text-white/85">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Terms of Service
          </h1>
          <p className="text-white/60">Last updated: May 2, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Agreement</h2>
            <p>
              By accessing{" "}
              <strong className="text-white">myvirtualfootball.com</strong> (the
              “Site”), using our Discord verification or linking tools, or
              participating in the Virtual Football League (“VFL,” “VF League”)
              community services we operate, you agree to these Terms. If you do
              not agree, do not use the Site or our verification flows.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">The service</h2>
            <p>
              The Site provides league information, statistics, and
              verification that connects your Discord identity with your Roblox
              account for league purposes. Features may change; we may limit or
              suspend access for security, rule violations, or maintenance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Accounts & rules</h2>
            <p>
              You must provide accurate information when using verification. You
              are responsible for activity under your Discord and Roblox
              accounts. League conduct, competition rules, and Discord server
              rules apply in addition to these Terms. Staff may approve or deny
              access in line with league policy.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Third-party services
            </h2>
            <p>
              We rely on <strong className="text-white">Discord</strong>,{" "}
              <strong className="text-white">Roblox</strong>, and hosting
              providers. Your use of those platforms is also governed by their
              respective terms and policies.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Disclaimers
            </h2>
            <p>
              The Site is provided “as is.” To the fullest extent permitted by
              law, we disclaim warranties of merchantability, fitness for a
              particular purpose, and non-infringement. We do not guarantee
              uninterrupted or error-free operation.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Limitation of liability
            </h2>
            <p>
              To the maximum extent permitted by applicable law, VFL and its
              operators will not be liable for any indirect, incidental,
              special, consequential, or punitive damages, or any loss of
              profits or data, arising from your use of the Site or verification
              tools.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Changes</h2>
            <p>
              We may update these Terms. The “Last updated” date will change;
              continued use after changes constitutes acceptance of the revised
              Terms where allowed by law.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p>
              Contact <strong className="text-white">VFL staff</strong> through
              the official Virtual Football League Discord server for
              questions about these Terms.
            </p>
          </section>

          <p className="border-t border-white/10 pt-6 text-white/60">
            <Link href="/privacy" className="text-white underline underline-offset-2">
              Privacy Policy
            </Link>
            {" · "}
            <Link href="/verify" className="text-white underline underline-offset-2">
              Verify
            </Link>
            {" · "}
            <Link href="/" className="text-white underline underline-offset-2">
              Home
            </Link>
          </p>
        </article>
      </div>
    </main>
  );
}
