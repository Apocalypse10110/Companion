/** Single source for the product name, so it is a one-line change. */
export const BRAND = {
  name: "Companion",
  tagline: "Your friendly helper",
  /** The hackathon this was built for. Shown on the About screen only. */
  event: "Ice Hacks",
} as const;

/**
 * Companion's mark: an open "C" that is also a listening ear, with the dot of a voice
 * in its opening. Drawn, not borrowed from the icon set, so it belongs to this app only.
 */
export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <path
        d="M36.3 13.7A16 16 0 1 0 36.3 34.3"
        fill="none"
        stroke="var(--c-accent)"
        strokeWidth="7.5"
        strokeLinecap="round"
      />
      <circle cx="35.5" cy="24" r="4.75" fill="var(--c-ink)" />
    </svg>
  );
}

export function BrandMark({ showTagline = false }: { showTagline?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <Mark className="size-10 shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className="display text-2xl text-ink">{BRAND.name}</span>
        {showTagline && <span className="text-base text-muted">{BRAND.tagline}</span>}
      </span>
    </div>
  );
}
