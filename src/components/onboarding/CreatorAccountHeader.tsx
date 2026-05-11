"use client";

import { useEffect, useState } from "react";

type SessionInfo = {
  robloxUsername: string | null;
  robloxAvatarUrl: string | null;
  discordUsername: string | null;
  discordAvatarUrl: string | null;
};

export function CreatorAccountHeader() {
  const [s, setS] = useState<SessionInfo | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/content/creators/session-info", {
          credentials: "same-origin",
        });
        const data = (await res.json()) as {
          session: null | {
            robloxUsername: string | null;
            robloxAvatarUrl: string | null;
            discordUsername: string | null;
            discordAvatarUrl: string | null;
          };
        };
        if (cancelled || !data.session) return;
        setS({
          robloxUsername: data.session.robloxUsername,
          robloxAvatarUrl: data.session.robloxAvatarUrl,
          discordUsername: data.session.discordUsername,
          discordAvatarUrl: data.session.discordAvatarUrl,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (
    !s ||
    (!s.robloxUsername &&
      !s.discordUsername)
  ) {
    return null;
  }

  return (
    <div className="border-border/60 bg-card/40 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2 text-sm">
      {s.robloxUsername ? (
        <div className="text-muted-foreground flex items-center gap-2">
          {s.robloxAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={s.robloxAvatarUrl}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full"
            />
          ) : null}
          <span className="text-foreground font-medium">{s.robloxUsername}</span>
          <span className="text-xs">Roblox</span>
        </div>
      ) : null}
      {s.discordUsername ? (
        <div className="text-muted-foreground flex items-center gap-2 border-l border-white/10 pl-3">
          {s.discordAvatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={s.discordAvatarUrl}
              alt=""
              width={28}
              height={28}
              className="size-7 rounded-full"
            />
          ) : null}
          <span className="text-foreground font-medium">{s.discordUsername}</span>
          <span className="text-xs">Discord</span>
        </div>
      ) : null}
    </div>
  );
}
