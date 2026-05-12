import { redirect } from "next/navigation";

/**
 * Old URL — onboarding intro now lives on `/content/creators/onboard`.
 */
export default async function LegacyOnboardHypeRedirect({
  searchParams,
}: {
  searchParams: Promise<{ discord_id?: string; preview?: string }>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  if (sp.discord_id?.trim()) q.set("discord_id", sp.discord_id.trim());
  if (sp.preview?.trim()) q.set("preview", sp.preview.trim());
  const suffix = q.toString() ? `?${q}` : "";
  redirect(`/content/creators/onboard${suffix}`);
}
