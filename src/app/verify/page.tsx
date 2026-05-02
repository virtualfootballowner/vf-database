import Link from "next/link";

export const dynamic = "force-dynamic";

function isVerifyConfigured(): boolean {
  const keys = [
    process.env.DISCORD_BOT_TOKEN,
    process.env.DISCORD_GUILD_ID,
    process.env.DISCORD_ROVER_VERIFIED_ROLE_ID,
    process.env.DISCORD_CLIENT_ID,
    process.env.DISCORD_CLIENT_SECRET,
    process.env.ROBLOX_OAUTH_CLIENT_ID,
    process.env.ROBLOX_OAUTH_CLIENT_SECRET,
    process.env.VFL_SITE_URL,
    process.env.VERIFY_COOKIE_SECRET,
  ];
  return keys.every((v) => typeof v === "string" && v.trim().length > 0);
}

export default function VerifyPage() {
  const configured = isVerifyConfigured();

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
        <p className="text-destructive text-sm">
          Verification isn&apos;t configured on this deployment yet (missing env
          keys).
        </p>
      )}
      <p className="text-muted-foreground text-xs">
        You must already be in the VFL Discord server. If you finish this page
        but aren&apos;t in the server, Discord can&apos;t update your nickname or
        role.
      </p>
    </main>
  );
}
