import Link from "next/link";
import type { Metadata } from "next";

import { CreatorOnboardIntro } from "@/components/onboarding/creator-onboard-intro";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
import { isDiscordUserId } from "@/lib/creator-onboard/validators";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "VF Create Program · Onboarding",
  description:
    "50,000 Robux prize pool and Custom VF Virtuoso Sponsorship. Start your VF Create application.",
  robots: { index: false, follow: false },
};

export default async function CreatorOnboardLanding({
  searchParams,
}: {
  searchParams: Promise<{ discord_id?: string }>;
}) {
  const sp = await searchParams;
  const fromQuery = sp.discord_id?.trim() ?? "";

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
      return (
        <OnboardingShell
          step={1}
          totalSteps={6}
          stepLabel="Start"
          title="VF Create Program"
          subtitle="Creator onboarding isn’t configured on this environment (missing secrets). Try again on the live site or contact staff."
        >
          <Link
            href="/"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
          >
            Back home
          </Link>
        </OnboardingShell>
      );
    }
  }

  const bootstrapHref = discordId
    ? `/api/content/creators/bootstrap?discord_id=${encodeURIComponent(discordId)}`
    : null;

  return <CreatorOnboardIntro bootstrapHref={bootstrapHref} />;
}
