import { cn } from "@/lib/utils";

export default function SectionLabel({
  children,
  className,
  light,
}: {
  children: React.ReactNode;
  className?: string;
  light?: boolean;
}) {
  return (
    <p
      className={cn(
        "flex items-center gap-3 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.25em]",
        light ? "text-hotel-champagne" : "text-hotel-gold",
        className,
      )}
    >
      <span className="h-px w-6 bg-current opacity-70" />
      {children}
    </p>
  );
}
