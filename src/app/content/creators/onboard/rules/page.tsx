"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { RulesContent } from "@/components/onboarding/RulesContent";
import { Button } from "@/components/ui/button";

export default function CreatorRulesPage() {
  const router = useRouter();
  const [agree, setAgree] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onContinue() {
    setError(null);
    if (!agree) {
      setError("Check the box to continue.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/content/creators/rules", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? "Could not save.");
        return;
      }
      router.push("/content/creators/onboard/expectations");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell
      step={5}
      totalSteps={7}
      stepLabel="Rules"
      title="Program rules"
      subtitle="Read the sections below, then confirm you agree."
    >
      <RulesContent />
      <div className="border-border/60 space-y-3 rounded-lg border p-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="accent-primary mt-1"
          />
          <span>
            I&apos;ve read and agree to the rules above for the VF Creator
            Program.
          </span>
        </label>
        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : null}
        <Button
          type="button"
          disabled={loading}
          className="w-full"
          onClick={() => void onContinue()}
        >
          {loading ? "Saving…" : "Continue"}
        </Button>
        <Link
          href="/content/creators/onboard/details"
          className="text-muted-foreground block text-center text-sm underline underline-offset-2"
        >
          Back
        </Link>
      </div>
    </OnboardingShell>
  );
}
