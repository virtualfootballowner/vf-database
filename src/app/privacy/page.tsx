import type { Metadata } from "next";
import Link from "next/link";

import { SiteNav } from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Privacy Policy · VF League",
  description:
    "How Virtual Football League (VFL) uses data when you verify with Discord and Roblox, browse league stats, and use our official website.",
};

export default function PrivacyPage() {
  return (
    <main className="relative min-h-screen w-full text-white">
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:px-8">
        <SiteNav />
        <article className="mt-10 space-y-6 text-sm leading-relaxed text-white/85">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Privacy Policy
          </h1>
          <p className="text-white/60">Last updated: May 2, 2026</p>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Who we are</h2>
            <p>
              <strong className="text-white">VF League</strong> (“VFL,” “we,”
              “us”) operates this website and related community tools for the
              Virtual Football League Roblox football community. The site is a
              league database and information surface for players and teams.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              What information we collect
            </h2>
            <ul className="list-disc space-y-2 pl-5">
              <li>
                <strong className="text-white">Roblox (OAuth).</strong> When you
                use our account linking / verification flow, Roblox may share
                with us your Roblox user identifier and profile information
                allowed by the scopes you approve (for example, username /
                display name as described in Roblox’s OAuth documentation). We
                use this only to verify identity, display league stats tied to
                your account, and manage Discord server access as described on
                our <Link href="/verify">verify</Link> page.
              </li>
              <li>
                <strong className="text-white">Discord (OAuth).</strong> When
                you sign in with Discord through our site, we receive your
                Discord user identifier so we can complete verification and
                update your server nickname and roles in our official Discord
                guild, consistent with Discord’s developer terms.
              </li>
              <li>
                <strong className="text-white">Database &amp; league data.</strong>{" "}
                We may store Roblox usernames / user ids, Discord ids, match
                statistics, roster information, and related league records
                necessary to run the league and display the site.
              </li>
              <li>
                <strong className="text-white">Technical data.</strong> Like most
                sites, our hosting provider may process IP addresses, request
                metadata, and cookies needed for security, routing, and basic
                operation of the service.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              How we use information
            </h2>
            <p>We use information to:</p>
            <ul className="list-disc space-y-2 pl-5">
              <li>Operate the league website and show accurate stats and rosters.</li>
              <li>
                Verify members, reduce impersonation, and sync allowed access in
                our Discord server.
              </li>
              <li>Maintain integrity of competition records and staff workflows.</li>
              <li>Secure the service and meet legal obligations where applicable.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">
              Sharing and processors
            </h2>
            <p>
              We use trusted infrastructure providers (for example, hosting and
              database services) to run the site. They process data only to
              provide our service. We do not sell your personal information. We
              may share information if required by law or to protect the safety
              and integrity of the league and its members.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Children</h2>
            <p>
              Our community may include minors. Parents or guardians should
              supervise online activity. If you believe we have collected
              information from a child in a way that concerns you, contact us
              through the VFL Discord staff team and we will address it
              promptly.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Your choices</h2>
            <p>
              You can disconnect from optional OAuth flows by not completing
              verification, or by requesting removal of Discord linkage
              through staff where league rules allow. Roblox and Discord provide
              their own privacy controls in their respective accounts.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-white">Contact</h2>
            <p>
              For privacy questions, contact the{" "}
              <strong className="text-white">VFL staff</strong> through the
              official Virtual Football League Discord server.
            </p>
          </section>

          <p className="border-t border-white/10 pt-6 text-white/60">
            <Link href="/terms" className="text-white underline underline-offset-2">
              Terms of Service
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
