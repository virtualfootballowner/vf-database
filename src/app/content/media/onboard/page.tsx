"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MEDIA_STAFF_ROLE_KEYS,
  MEDIA_STAFF_ROLE_LABEL,
  type MediaStaffRoleKey,
} from "@/lib/media-staff/media-staff-roles";

export default function MediaStaffOnboardPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [robloxUsername, setRobloxUsername] = useState<string | null>(null);
  const [role, setRole] = useState<MediaStaffRoleKey | "">("");
  const [otherDetail, setOtherDetail] = useState("");
  const [experienceLink, setExperienceLink] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/content/media-staff/session", {
          credentials: "same-origin",
        });
        const data = (await res.json()) as {
          ok?: boolean;
          robloxUsername?: string;
          error?: string;
        };
        if (cancelled) return;
        if (data.ok && data.robloxUsername) {
          setRobloxUsername(data.robloxUsername);
        }
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
    if (!role) {
      setError("Pick what kind of media work you do.");
      return;
    }
    if (role === "other" && otherDetail.trim().length < 2) {
      setError("Briefly describe your role.");
      return;
    }
    if (!experienceLink.trim() && !file) {
      setError("Add a link to your work or upload a file (or both).");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.set("role", role);
      if (experienceLink.trim()) fd.set("experience_link", experienceLink.trim());
      if (role === "other") fd.set("other_detail", otherDetail.trim());
      if (file) fd.set("portfolio", file);

      const res = await fetch("/api/content/media-staff/submit", {
        method: "POST",
        credentials: "same-origin",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Something went wrong.");
        return;
      }
      router.push("/content/media/onboard/success");
    } finally {
      setLoading(false);
    }
  }

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-lg px-4 py-12 sm:py-16">
        <p className="text-muted-foreground text-sm">Loading…</p>
      </main>
    );
  }

  if (!robloxUsername) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-4 px-4 py-12 sm:py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Verify first
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your session expired or you haven&apos;t finished Discord + Roblox
          sign-in yet. Start from the staff verify page, then you&apos;ll land
          here automatically.
        </p>
        <Link
          href="/verify/media-staff"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 w-full items-center justify-center rounded-md px-4 text-sm font-medium transition-colors sm:w-auto"
        >
          Go to verify
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-10 sm:py-14">
      <h1 className="text-2xl font-semibold tracking-tight">Media staff application</h1>
      <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
        Roblox linked as <strong className="text-foreground">{robloxUsername}</strong>.
        Tell us what you do and share samples. Staff will review your card in
        Discord (same approvals channel as VF Create). No data is saved on our
        servers beyond posting to Discord.
      </p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Your focus</legend>
          <p className="text-muted-foreground text-xs">
            Choose the option that fits best.
          </p>
          <div className="flex flex-col gap-2">
            {MEDIA_STAFF_ROLE_KEYS.map((k) => (
              <label
                key={k}
                className="flex cursor-pointer items-center gap-2 text-sm"
              >
                <input
                  type="radio"
                  name="role"
                  value={k}
                  checked={role === k}
                  onChange={() => setRole(k)}
                  className="text-primary border-input h-4 w-4"
                />
                {MEDIA_STAFF_ROLE_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>

        {role === "other" ? (
          <div className="space-y-2">
            <Label htmlFor="other_detail">Describe your role</Label>
            <Input
              id="other_detail"
              value={otherDetail}
              onChange={(e) => setOtherDetail(e.target.value)}
              placeholder="e.g. motion graphics, social editor, photographer…"
              maxLength={500}
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="experience_link">Portfolio / work link (optional if you upload a file)</Label>
          <Input
            id="experience_link"
            type="url"
            inputMode="url"
            value={experienceLink}
            onChange={(e) => setExperienceLink(e.target.value)}
            placeholder="https://…"
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="portfolio">Upload sample (optional if you add a link)</Label>
          <Input
            id="portfolio"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.zip,application/pdf,image/*,application/zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="cursor-pointer"
          />
          <p className="text-muted-foreground text-xs">
            PDF, PNG, JPEG, WebP, or ZIP — max 8 MB.
          </p>
        </div>

        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : null}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Submitting…" : "Submit for review"}
        </Button>
        <Link
          href="/verify/media-staff"
          className="text-muted-foreground text-center text-sm underline underline-offset-2"
        >
          Start over (re-verify)
        </Link>
      </form>
    </main>
  );
}
