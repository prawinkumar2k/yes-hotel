/**
 * The YES HOTELS logo (owner-supplied artwork in /public/brand).
 *   variant="full" — gold Y mark with the YES HOTELS wordmark
 *   variant="mark" — the gold Y on its own, for tight spaces (navbars, icons)
 */
type Props = { variant?: "full" | "mark"; className?: string; alt?: string };

export default function BrandLogo({ variant = "mark", className = "", alt = "YES HOTELS" }: Props) {
  const src = variant === "full" ? "/brand/yes-hotels-logo-sm.png" : "/brand/yes-mark.png";
  return <img src={src} alt={alt} className={`object-contain select-none ${className}`} draggable={false} />;
}
