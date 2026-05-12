import { redirect } from "next/navigation";

/**
 * Old URL — onboarding lives on `/content/creators/onboard`.
 */
export default async function LegacyOnboardHypeRedirect({
  searchParams,
}: {
  searchParams: Promise<{ discord_id?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.discord_id?.trim()) q.set("discord_id", sp.discord_id.trim());
  const suffix = q.toString() ? `?${q}` : "";
  redirect(`/content/creators/onboard${suffix}`);
}
