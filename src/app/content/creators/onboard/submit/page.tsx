"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";

type Row = {
  roblox_username: string;
  discord_username: string | null;
  tiktok_handle: string | null;
  youtube_handle: string | null;
  age: number | null;
  country: string | null;
  email: string | null;
};

export default function CreatorSubmitPage() {
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/content/creators/session-info", {
          credentials: "same-origin",
        });
        const data = (await res.json()) as {
          session: null | {
            db: null | Row;
          };
        };
        if (cancelled || !data.session?.db) return;
        const d = data.session.db;
        setRow({
          roblox_username: d.roblox_username,
          discord_username: d.discord_username,
          tiktok_handle: d.tiktok_handle,
          youtube_handle: d.youtube_handle,
          age: d.age,
          country: d.country,
          email: d.email,
        });
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/content/creators/submit", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Submit failed.");
        return;
      }
      router.push("/content/creators/onboard/success");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell
      step={7}
      totalSteps={7}
      stepLabel="Review"
      title="Review your application"
      subtitle="Submit when everything looks right. Staff usually respond within 48 hours via Discord DM."
    >
      {row ? (
        <ul className="text-muted-foreground space-y-2 text-sm">
          <li>
            <span className="text-foreground font-medium">Roblox:</span>{" "}
            {row.roblox_username}
          </li>
          <li>
            <span className="text-foreground font-medium">Discord:</span>{" "}
            {row.discord_username ?? "—"}
          </li>
          <li>
            <span className="text-foreground font-medium">TikTok:</span>{" "}
            {row.tiktok_handle ? `@${row.tiktok_handle}` : "—"}
          </li>
          <li>
            <span className="text-foreground font-medium">YouTube:</span>{" "}
            {row.youtube_handle ? `@${row.youtube_handle}` : "—"}
          </li>
          <li>
            <span className="text-foreground font-medium">Age:</span>{" "}
            {row.age ?? "—"}
          </li>
          <li>
            <span className="text-foreground font-medium">Country:</span>{" "}
            {row.country ?? "—"}
          </li>
          <li>
            <span className="text-foreground font-medium">Email:</span>{" "}
            {row.email ?? "—"}
          </li>
        </ul>
      ) : (
        <p className="text-muted-foreground text-sm">Loading your draft…</p>
      )}
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          disabled={loading || !row}
          className="w-full"
          onClick={() => void onSubmit()}
        >
          {loading ? "Submitting…" : "Submit application"}
        </Button>
        <Link
          href="/content/creators/onboard/expectations"
          className="text-muted-foreground text-center text-sm underline underline-offset-2"
        >
          Back
        </Link>
      </div>
    </OnboardingShell>
  );
}
