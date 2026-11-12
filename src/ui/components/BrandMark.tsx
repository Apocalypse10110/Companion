import { MessageCircleHeart } from "lucide-react";

/** Single source for the product name, so it is a one-line change. */
export const BRAND = {
  name: "Companion",
  tagline: "Your friendly helper",
  /** The hackathon this was built for. Shown on the About screen only. */
  event: "Ice Hacks",
} as const;

export function BrandMark({ showTagline = false }: { showTagline?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-2xl bg-accent text-on-accent">
        <MessageCircleHeart className="size-7" strokeWidth={2.25} />
      </span>
      <span className="flex flex-col leading-tight">
        <span className="text-2xl font-bold text-ink">{BRAND.name}</span>
        {showTagline && <span className="text-base text-muted">{BRAND.tagline}</span>}
      </span>
    </div>
  );
}
