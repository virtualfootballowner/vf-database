import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export const dynamic = "force-dynamic";

function isDiscordUserId(value: string): boolean {
  return /^\d{17,20}$/.test(value.trim());
}

export default async function CreatorOnboardLanding({
  searchParams,
}: {
  searchParams: Promise<{ discord_id?: string }>;
}) {
  const sp = await searchParams;
  const rawId = sp.discord_id?.trim() ?? "";
  const valid = isDiscordUserId(rawId);

  if (!valid) {
    return (
      <OnboardingShell
        step={1}
        totalSteps={6}
        stepLabel="Start"
        title="Creator onboarding"
        subtitle="Open your personalized link from the VF Discord bot (Start Application). Links include your Discord ID and only work for that account."
      >
        <p className="text-muted-foreground text-sm">
          If you were sent here from Discord, go back and click the button on
          the creator card again so the URL includes your{" "}
          <code className="text-foreground/90">discord_id</code> parameter.
        </p>
      </OnboardingShell>
    );
  }

  const startHref = `/api/content/creators/bootstrap?discord_id=${encodeURIComponent(rawId)}`;

  return (
    <OnboardingShell
      step={1}
      totalSteps={6}
      stepLabel="Welcome"
      title="Welcome to the VF Creator Program"
      subtitle="Early access to VF, creator challenges, and community spotlights. The next screens take about three minutes: connect Discord, share a few details, and accept the program rules."
    >
      <div className="flex flex-col gap-4">
        <Link
          href={startHref}
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Start onboarding
        </Link>
        <p className="text-muted-foreground text-xs leading-relaxed">
          You must finish Discord connect with the same account this link was
          generated for. Trying to use another Discord login will fail on
          purpose.
        </p>
      </div>
    </OnboardingShell>
  );
}
