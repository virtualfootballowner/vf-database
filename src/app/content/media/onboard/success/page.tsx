import Link from "next/link";

export default function MediaStaffOnboardSuccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-6 px-4 py-12 sm:py-16">
      <h1 className="text-2xl font-semibold tracking-tight text-green-600 dark:text-green-400">
        Application sent
      </h1>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Staff received your media staff application in the review channel. Watch
        your Discord DMs — we&apos;ll only grant the media staff role after
        someone approves you there.
      </p>
      <Link
        href="/"
        className="text-primary text-sm font-medium underline underline-offset-4"
      >
        Back to home
      </Link>
    </main>
  );
}
