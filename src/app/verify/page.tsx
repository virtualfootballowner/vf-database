import Link from "next/link";

export const dynamic = "force-dynamic";

const VERIFY_ENV_KEYS = [
  "DISCORD_BOT_TOKEN",
  "DISCORD_GUILD_ID",
  "DISCORD_ROVER_VERIFIED_ROLE_ID",
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "ROBLOX_OAUTH_CLIENT_ID",
  "ROBLOX_OAUTH_CLIENT_SECRET",
  "VFL_SITE_URL",
  "VERIFY_COOKIE_SECRET",
] as const;

function missingVerifyEnvKeys(): string[] {
  const env = process.env;
  return VERIFY_ENV_KEYS.filter((name) => {
    const v = env[name];
    return typeof v !== "string" || v.trim().length === 0;
  });
}

export default function VerifyPage() {
  const missing = missingVerifyEnvKeys();
  const configured = missing.length === 0;

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Verify for VFL</h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Link your Discord account with Roblox in two steps. We&apos;ll set your
        server nickname to your Roblox username and queue you for staff approval
        — same flow as before, without a third-party verify bot.
      </p>
      <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
        <li>Sign in with Discord (the account you use in the VFL server).</li>
        <li>Sign in with Roblox and approve access.</li>
      </ol>
      {configured ? (
        <Link
          href="/api/verify/start"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium transition-colors"
        >
          Click to verify
        </Link>
      ) : (
        <div className="border-destructive/50 bg-destructive/5 space-y-2 rounded-md border p-4 text-sm">
          <p className="text-destructive font-medium">
            Verification isn&apos;t configured — add these environment variables
            (empty = missing):
          </p>
          <ul className="font-mono text-muted-foreground list-disc space-y-1 pl-5 text-xs">
            {missing.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Local: <code className="text-foreground/90">.env.local</code>. Production: Vercel
            project → Settings → Environment Variables. Set{" "}
            <code className="text-foreground/90">VFL_SITE_URL</code> to your real public URL
            and register the same base in Discord + Roblox OAuth redirect URLs.
          </p>
        </div>
      )}
      <p className="text-muted-foreground text-xs">
        You must already be in the VFL Discord server. If you finish this page
        but aren&apos;t in the server, Discord can&apos;t update your nickname or
        role.
      </p>
    </main>
  );
}
