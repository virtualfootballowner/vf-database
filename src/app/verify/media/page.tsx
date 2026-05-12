import Link from "next/link";

export const dynamic = "force-dynamic";

const MEDIA_VERIFY_ENV_KEYS = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "ROBLOX_OAUTH_CLIENT_ID",
  "ROBLOX_OAUTH_CLIENT_SECRET",
  "VFL_SITE_URL",
  "VERIFY_COOKIE_SECRET",
] as const;

function missingMediaVerifyEnvKeys(): string[] {
  const env = process.env;
  const missing = MEDIA_VERIFY_ENV_KEYS.filter((name) => {
    const v = env[name];
    return typeof v !== "string" || v.trim().length === 0;
  }) as string[];
  const mediaGuild =
    env.DISCORD_MEDIA_GUILD_ID?.trim() ||
    env.DISCORD_CREATOR_VF_GUILD_ID?.trim();
  if (!mediaGuild) {
    missing.push("DISCORD_MEDIA_GUILD_ID (or DISCORD_CREATOR_VF_GUILD_ID)");
  }
  return missing;
}

export default function VerifyMediaPage() {
  const missing = missingMediaVerifyEnvKeys();
  const configured = missing.length === 0;

  return (
    <main className="mx-auto flex min-h-dvh min-w-0 max-w-lg flex-col justify-center gap-6 overflow-x-clip px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        Verify for VF Media
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Link your Discord with Roblox in two quick steps. We&apos;ll set your
        nickname in the VF Media server to your Roblox username — that&apos;s
        the only thing this page does. No roles, no review, no database.
      </p>
      <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
        <li>Sign in with Discord (the account you use in the VF Media server).</li>
        <li>Sign in with Roblox and approve access.</li>
      </ol>
      {configured ? (
        <Link
          href="/api/verify/media/start"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Click to verify
        </Link>
      ) : (
        <div className="border-destructive/50 bg-destructive/5 space-y-2 rounded-md border p-4 text-sm">
          <p className="text-destructive font-medium">
            Media verification isn&apos;t configured — add these environment
            variables (empty = missing):
          </p>
          <ul className="font-mono text-muted-foreground list-disc space-y-1 pl-5 text-xs">
            {missing.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">
            <code className="text-foreground/90">DISCORD_MEDIA_GUILD_ID</code>{" "}
            must be the VF Media guild. The bot needs Manage Nicknames in
            that server, and the Discord + Roblox OAuth apps must include the
            redirect URIs{" "}
            <code className="text-foreground/90">
              /api/verify/media/discord/callback
            </code>{" "}
            and{" "}
            <code className="text-foreground/90">
              /api/verify/media/roblox/callback
            </code>
            .
          </p>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        You must already be in the VF Media Discord server. If you finish
        this page but aren&apos;t in the server, Discord can&apos;t update
        your nickname.
      </p>
      <p className="text-muted-foreground text-xs">
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy Policy
        </Link>
        {" · "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms of Service
        </Link>
      </p>
    </main>
  );
}
