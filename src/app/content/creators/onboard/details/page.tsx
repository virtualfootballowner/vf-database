"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COUNTRIES } from "@/lib/creator-onboard/countries";

export default function CreatorDetailsPage() {
  const router = useRouter();
  const [robloxLabel, setRobloxLabel] = useState<string | null>(null);
  const [tiktok, setTiktok] = useState("");
  const [youtube, setYoutube] = useState("");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
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
            robloxUsername: string | null;
            email: string | null;
            db: {
              roblox_username: string | null;
              email: string | null;
              age: number | null;
              country: string | null;
              tiktok_handle: string | null;
              youtube_handle: string | null;
            } | null;
          };
        };
        if (cancelled || !data.session) return;
        const db = data.session.db;
        const rb =
          db?.roblox_username?.trim() ||
          data.session.robloxUsername?.trim() ||
          null;
        setRobloxLabel(rb);
        if (db?.email?.trim()) setEmail(db.email.trim());
        else if (data.session.email?.trim())
          setEmail(data.session.email.trim());
        if (db?.age != null) setAge(String(db.age));
        if (db?.country) setCountry(db.country);
        if (db?.tiktok_handle) setTiktok(db.tiktok_handle);
        if (db?.youtube_handle) setYoutube(db.youtube_handle);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/content/creators/draft", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tiktok_handle: tiktok.trim() || null,
          youtube_handle: youtube.trim() || null,
          age: Number.parseInt(age, 10),
          country,
          email: email.trim(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not save. Check the form.");
        return;
      }
      router.push("/content/creators/onboard/rules");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell
      step={3}
      totalSteps={6}
      stepLabel="Details"
      title="Your details"
      subtitle="Roblox is already linked from the last step. Add your TikTok, age, and country. YouTube and email are optional."
    >
      {!hydrated ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {robloxLabel ? (
            <p className="text-muted-foreground border-border/60 rounded-lg border px-3 py-2 text-sm">
              <span className="text-foreground font-medium">Roblox: </span>
              {robloxLabel}
            </p>
          ) : (
            <p className="text-destructive text-sm">
              No Roblox account on this draft. Go back and connect Roblox first.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="tiktok">TikTok handle</Label>
            <Input
              id="tiktok"
              value={tiktok}
              onChange={(e) => setTiktok(e.target.value)}
              placeholder="@username"
              required
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="youtube">YouTube handle (optional)</Label>
            <Input
              id="youtube"
              value={youtube}
              onChange={(e) => setYoutube(e.target.value)}
              placeholder="@channel or handle"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min={13}
              max={120}
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
              autoComplete="bday-year"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <select
              id="country"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            >
              <option value="">Choose…</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email (optional)</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          {error ? (
            <p className="text-destructive text-sm">{error}</p>
          ) : null}
          <Button
            type="submit"
            disabled={loading || !robloxLabel}
            className="w-full"
          >
            {loading ? "Saving…" : "Continue"}
          </Button>
          <Link
            href="/content/creators/onboard/discord"
            className="text-muted-foreground text-center text-sm underline underline-offset-2"
          >
            Back
          </Link>
        </form>
      )}
    </OnboardingShell>
  );
}
