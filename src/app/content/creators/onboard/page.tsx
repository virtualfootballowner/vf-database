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

  if (discordId || showPhotoPreview) {
    return (
      <CreatorOnboardIntro
        bootstrapHref={bootstrapHref}
        showPhotoPreview={showPhotoPreview}
      />
    );
  }

  return (
    <OnboardingShell
      step={1}
      totalSteps={6}
      stepLabel="Start"
      title="VF Create Program"
      subtitle="Open your personalized link from the VF Discord bot (Start application). Links include your Discord ID and only work for that account."
    >
      <p className="text-muted-foreground text-sm">
        If you were sent here from Discord, go back and click the button on the
        creator card again so the URL includes your{" "}
        <code className="text-foreground/90">discord_id</code> parameter.
      </p>
      <p className="text-muted-foreground text-sm">
        Already started?{" "}
        <Link
          href="/content/creators/onboard"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Open onboarding
        </Link>{" "}
        — we&apos;ll resume if your session is still active.
      </p>
    </OnboardingShell>
  );
}
