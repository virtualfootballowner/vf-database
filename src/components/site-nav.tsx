import Link from "next/link";

type SiteNavProps = {
  active?: "home" | "stats" | "teams" | "players";
};

const links: { href: string; label: string; key: SiteNavProps["active"] }[] = [
  { href: "/", label: "Home", key: "home" },
  { href: "/stats", label: "Stats", key: "stats" },
  { href: "/teams", label: "Teams", key: "teams" },
  { href: "/players", label: "Players", key: "players" },
];

export function SiteNav({ active = "home" }: SiteNavProps) {
  return (
    <header className="glass sticky top-4 z-40 mx-auto flex w-fit items-center gap-3 rounded-full px-4 py-2">
      <Link href="/" className="flex items-center">
        <span
          className="font-display text-2xl leading-none tracking-[0.08em] text-white drop-shadow-[0_2px_12px_rgba(8,54,150,0.6)]"
          aria-label="VF League"
        >
          VF
        </span>
      </Link>

      <span aria-hidden className="h-4 w-px bg-white/15" />

      <nav className="flex items-center gap-0.5 text-sm font-medium text-white/75">
        {links.map((link) => {
          const isActive = link.key === active;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-full px-3 py-1.5 transition ${
                isActive
                  ? "bg-white text-zinc-950"
                  : "hover:bg-white/10 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
