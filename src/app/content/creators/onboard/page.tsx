import Link from "next/link";
import { redirect } from "next/navigation";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { readCreatorSessionPayload } from "@/lib/creator-onboard/cookie-helpers";
import { isDiscordUserId } from "@/lib/creator-onboard/validators";

export const dynamic = "force-dynamic";

export default async function CreatorOnboardLanding({
  searchParams,
}: {
  searchParams: Promise<{ discord_id?: string }>;
}) {
  const sp = await searchParams;
  const rawId = sp.discord_id?.trim() ?? "";

  if (isDiscordUserId(rawId)) {
    redirect(
      `/content/creators/onboard/hype?discord_id=${encodeURIComponent(rawId)}`,
    );
  }

  try {
    const { session } = await readCreatorSessionPayload();
    if (
      session?.expectedDiscordId &&
      isDiscordUserId(session.expectedDiscordId)
    ) {
      redirect("/content/creators/onboard/hype");
    }
  } catch {
    /* env not configured — fall through */
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
          href="/content/creators/onboard/hype"
          className="text-foreground font-medium underline underline-offset-2"
        >
          Open the hype page
        </Link>{" "}
        if you still have an active session.
      </p>
    </OnboardingShell>
  );
}
