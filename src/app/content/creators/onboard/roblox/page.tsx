import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default function CreatorRobloxStep() {
  return (
    <OnboardingShell
      step={2}
      totalSteps={6}
      stepLabel="Connect Roblox"
      title="Connect your Roblox account"
      subtitle="We use official Roblox OpenID so we can verify your profile for creator competitions and payouts."
    >
      <div className="flex flex-col gap-4">
        <Link
          href="/api/content/creators/roblox/start"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Continue with Roblox
        </Link>
        <Link
          href="/content/creators/onboard"
          className="text-muted-foreground text-center text-sm underline underline-offset-2"
        >
          Back to welcome
        </Link>
      </div>
    </OnboardingShell>
  );
}
