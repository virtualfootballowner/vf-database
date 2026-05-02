import Link from "next/link";

const MESSAGES: Record<string, { title: string; body: string }> = {
  ok: {
    title: "You’re verified on Discord",
    body:
      "Your nickname was set to your Roblox name and the verified role was applied. Check the server for staff review — you’ll get a DM when you’re approved.",
  },
  not_in_guild: {
    title: "Join the VFL server first",
    body:
      "We couldn’t find your Discord account in the VFL server. Join the guild, then open this page again and click **Click to verify**.",
  },
  nick_forbidden: {
    title: "Couldn’t set your nickname",
    body:
      "The bot may be below your top role in the hierarchy. Ask staff to move the bot role up (Manage Nicknames), or set your nickname manually to your Roblox username and tell staff.",
  },
  discord_denied: {
    title: "Discord sign-in cancelled",
    body: "Start again from the link when you’re ready.",
  },
  discord_state: {
    title: "Session expired (Discord)",
    body: "Open the verify page again and start from **Click to verify**.",
  },
  discord_token: {
    title: "Discord login failed",
    body: "Try again. If it keeps failing, tell staff — OAuth may be misconfigured.",
  },
  roblox_denied: {
    title: "Roblox sign-in cancelled",
    body:
      "You need to finish Roblox login to link your account. Try again when ready.",
  },
  roblox_state: {
    title: "Session expired (Roblox)",
    body: "Open the verify page again and complete both steps in one go.",
  },
  roblox_token: {
    title: "Roblox login failed",
    body:
      "Try again. Check that the Roblox OAuth app redirect URL matches this site.",
  },
  session: {
    title: "Session missing",
    body: "Start again from the verify page — don’t bookmark the Roblox callback URL.",
  },
  session_expired: {
    title: "Session expired",
    body: "Verification took too long. Go back and click **Click to verify** again.",
  },
  discord_api: {
    title: "Discord API error",
    body:
      "Something went wrong updating your member. Try again or ask staff to check bot permissions (Manage Nicknames, Manage Roles).",
  },
  config: {
    title: "Not configured",
    body: "This environment is missing verification settings. Staff need to add OAuth env vars.",
  },
};

type Props = { searchParams: Promise<{ ok?: string; err?: string }> };

export default async function VerifyDonePage({ searchParams }: Props) {
  const sp = await searchParams;
  const ok = sp.ok === "1";
  const errKey = sp.err ?? "";
  const preset = ok
    ? MESSAGES.ok
    : MESSAGES[errKey] ?? {
        title: "Something went wrong",
        body: "Go back and try again, or ask staff for help.",
      };

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <h1
        className={`text-2xl font-semibold tracking-tight ${ok ? "text-green-600 dark:text-green-400" : ""}`}
      >
        {preset.title}
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {preset.body}
      </p>
      <Link
        href="/verify"
        className="text-primary text-sm font-medium underline underline-offset-4"
      >
        Back to verify
      </Link>
    </main>
  );
}
