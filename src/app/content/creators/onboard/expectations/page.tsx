"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ExpectationsContent } from "@/components/onboarding/ExpectationsContent";
import { OnboardingShell } from "@/components/onboarding/OnboardingShell";
import { Button } from "@/components/ui/button";

export default function CreatorExpectationsPage() {
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
      const res = await fetch("/api/content/creators/expectations", {
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
      router.push("/content/creators/onboard/submit");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingShell
      step={5}
      totalSteps={6}
      stepLabel="Expectations"
      title="Creator expectations"
      subtitle="How we work together during VF’s closed test — plain language, not legal advice."
    >
      <ExpectationsContent />
      <div className="border-border/60 space-y-3 rounded-lg border p-3">
        <label className="flex cursor-pointer items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="accent-primary mt-1"
          />
          <span>I understand and agree to these expectations.</span>
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
          {loading ? "Saving…" : "Continue to review"}
        </Button>
        <Link
          href="/content/creators/onboard/rules"
          className="text-muted-foreground block text-center text-sm underline underline-offset-2"
        >
          Back
        </Link>
      </div>
    </OnboardingShell>
  );
}
