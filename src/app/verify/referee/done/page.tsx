import Link from "next/link";

const MESSAGES: Record<string, { title: string; body: string }> = {
  ok: {
    title: "Verification complete",
    body:
      "Your nickname in the VF Referee server is now your Roblox username. Staff will review your verification in the approval channel — you'll get the Referee role if approved.",
  },
  already_pending: {
    title: "Already pending review",
    body:
      "Your verification is already waiting for staff. Your nickname was refreshed to your Roblox username.",
  },
  already_active: {
    title: "You're already an active referee",
    body:
      "No further verification is needed. Use /ref-my-games in Discord to see your fixtures.",
  },
  not_in_guild: {
    title: "Join the VF Referee server first",
    body:
      "We couldn't find your Discord account in the VF Referee server. Join it, then come back to this page and click **Click to verify** again.",
  },
  nick_forbidden: {
    title: "Couldn't set your nickname",
    body:
      "The bot may be below your top role in the hierarchy. Ask staff to move the bot role up (Manage Nicknames), or set your nickname manually to your Roblox username.",
  },
  discord_denied: {
    title: "Discord sign-in cancelled",
    body: "Start again from the link when you're ready.",
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
    body:
      "Start again from the verify page — don't bookmark the Roblox callback URL.",
  },
  session_expired: {
    title: "Session expired",
    body:
      "Verification took too long. Go back and click **Click to verify** again.",
  },
  discord_api: {
    title: "Discord API error",
    body:
      "Something went wrong updating your member. Try again or ask staff to check bot permissions (Manage Nicknames).",
  },
  suspended: {
    title: "Account suspended",
    body:
      "Your referee account is suspended. Contact staff if you think this is a mistake.",
  },
  card_failed: {
    title: "Verified, but staff weren't notified",
    body:
      "Your nickname was updated and your profile was saved, but we couldn't post the staff review card. Tell staff you completed verify.",
  },
  db_error: {
    title: "Couldn't save verification",
    body:
      "Your nickname may have been updated, but saving your profile failed. Try again or contact staff.",
  },
  config: {
    title: "Not configured",
    body:
      "This environment is missing the referee verification settings. Staff need to add the env vars.",
  },
};

type Props = {
  searchParams: Promise<{
    ok?: string;
    already_pending?: string;
    already_active?: string;
    err?: string;
    stage?: string;
    st?: string;
    ec?: string;
    ed?: string;
  }>;
};

export default async function VerifyRefereeDonePage({ searchParams }: Props) {
  const sp = await searchParams;
  const successKey = sp.ok === "1"
    ? "ok"
    : sp.already_pending === "1"
      ? "already_pending"
      : sp.already_active === "1"
        ? "already_active"
        : null;
  const errKey = sp.err ?? "";
  const preset = successKey
    ? MESSAGES[successKey]
    : (MESSAGES[errKey] ?? {
        title: "Something went wrong",
        body: "Go back and try again, or ask staff for help.",
      });

  const ok = Boolean(successKey);

  const debugBits = [
    sp.stage ? `stage=${sp.stage}` : null,
    sp.st ? `status=${sp.st}` : null,
    sp.ec ? `error=${sp.ec}` : null,
    sp.ed ? `description=${sp.ed}` : null,
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto flex min-h-dvh min-w-0 max-w-lg flex-col justify-center gap-6 overflow-x-clip px-4 py-12 sm:px-6 sm:py-16">
      <h1
        className={`text-2xl font-semibold tracking-tight ${
          ok ? "text-green-600 dark:text-green-400" : ""
        }`}
      >
        {preset.title}
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap">
        {preset.body}
      </p>
      {!ok && debugBits.length > 0 ? (
        <pre className="border-destructive/40 bg-destructive/5 text-muted-foreground overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed">
          {debugBits.join("\n")}
        </pre>
      ) : null}
      <Link
        href="/verify/referee"
        className="text-primary text-sm font-medium underline underline-offset-4"
      >
        Back to referee verify
      </Link>
    </main>
  );
}
