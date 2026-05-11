import Link from "next/link";

import { CreatorAccountHeader } from "@/components/onboarding/CreatorAccountHeader";
import { StepIndicator } from "@/components/onboarding/StepIndicator";

export function OnboardingShell(props: {
  step: number;
  totalSteps: number;
  stepLabel: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh min-w-0 max-w-lg flex-col gap-6 px-4 py-10 sm:px-6 sm:py-14">
      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          VF Creator Program
        </p>
        <StepIndicator
          current={props.step}
          total={props.totalSteps}
          label={props.stepLabel}
        />
        <CreatorAccountHeader />
        <h1 className="text-2xl font-semibold tracking-tight">
          {props.title}
        </h1>
        {props.subtitle ? (
          <p className="text-muted-foreground text-sm leading-relaxed">
            {props.subtitle}
          </p>
        ) : null}
      </div>
      {props.children}
      <p className="text-muted-foreground pt-4 text-center text-xs">
        <Link href="/privacy" className="underline underline-offset-2">
          Privacy
        </Link>
        {" · "}
        <Link href="/terms" className="underline underline-offset-2">
          Terms
        </Link>
      </p>
    </main>
  );
}
