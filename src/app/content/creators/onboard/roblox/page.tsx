import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

export default function CreatorRobloxStep() {
  return (
    <OnboardingShell
      step={1}
      totalSteps={6}
      stepLabel="Connect Roblox"
      title="Connect your Roblox account"
      subtitle="We use official Roblox OpenID to verify your profile for the creator program. You’ll be redirected back here, then connect Discord."
    >
      <div className="flex flex-col gap-4">
        <Link
          href="/api/content/creators/roblox/start"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Continue with Roblox
        </Link>
        <Link
          href="/content/creators/onboard/hype"
          className="text-muted-foreground text-center text-sm underline underline-offset-2"
        >
          Back
        </Link>
      </div>
    </OnboardingShell>
  );
}
