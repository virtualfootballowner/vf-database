import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

const invite =
  process.env.NEXT_PUBLIC_VF_DISCORD_INVITE_URL?.trim() || "https://discord.com";

export default function CreatorSuccessPage() {
  return (
    <OnboardingShell
      step={7}
      totalSteps={7}
      stepLabel="Done"
      title="Application submitted"
      subtitle="You’ll hear back within about 48 hours via Discord DM. Keep DMs from server members open."
    >
      <div className="flex flex-col gap-4">
        <a
          href={invite}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Open VF Discord
        </a>
        <Link
          href="/"
          className="text-muted-foreground text-center text-sm underline underline-offset-2"
        >
          Back to site home
        </Link>
      </div>
    </OnboardingShell>
  );
}
