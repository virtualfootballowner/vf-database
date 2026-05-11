import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default function CreatorDiscordStep() {
  return (
    <OnboardingShell
      step={3}
      totalSteps={7}
      stepLabel="Connect Discord"
      title="Connect your Discord account"
      subtitle="We need the same Discord you used in the VF server so we can DM you and, if you’re approved, assign your creator role."
    >
      <div className="flex flex-col gap-4">
        <Link
          href="/api/content/creators/discord/start"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Continue with Discord
        </Link>
        <Link
          href="/api/content/creators/roblox/start"
          className="text-muted-foreground text-center text-sm underline underline-offset-2"
        >
          Re-connect Roblox
        </Link>
      </div>
    </OnboardingShell>
  );
}
