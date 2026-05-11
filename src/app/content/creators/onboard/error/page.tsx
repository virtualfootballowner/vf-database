import Link from "next/link";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";

const MESSAGES: Record<string, string> = {
  denied: "Roblox or Discord sign-in was cancelled.",
  state: "Security check failed (state). Try again from the Discord link.",
  session: "Your session expired. Open the bot link again.",
  token: "Could not complete sign-in. Try again in a few minutes.",
  pending: "You already have an application waiting for staff review.",
  roblox_taken: "This Roblox account is already tied to another open application.",
  db: "Something went wrong saving your draft. Try again or contact staff.",
  db_error: "Something went wrong saving. Try again.",
  discord_denied: "Discord sign-in was cancelled.",
  discord_state: "Discord security check failed. Try again.",
  discord_token: "Discord token exchange failed. Check OAuth redirect URLs.",
  discord_mismatch:
    "You must sign in with the Discord account that started this link.",
  not_found: "Application not found.",
  not_draft: "This application was already submitted or is no longer a draft.",
  discord_mismatch_internal: "Could not verify Discord on this application.",
};

export default async function CreatorErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const sp = await searchParams;
  const code = sp.c?.trim() ?? "unknown";
  const msg = MESSAGES[code] ?? "Something went wrong.";

  return (
    <OnboardingShell
      step={1}
      totalSteps={6}
      stepLabel="Error"
      title="We hit a snag"
      subtitle={msg}
    >
      <Link
        href="/content/creators/onboard"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
      >
        Start over
      </Link>
    </OnboardingShell>
  );
}
