import { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CommonProps = {
  children: ReactNode;
  className?: string;
};

export function GoldButton({
  children,
  className,
  href,
  ...props
}: CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: string }) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap bg-hotel-gold px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] text-hotel-black transition-all duration-300 hover:bg-hotel-champagne active:scale-[0.98]",
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  className,
  href,
  light,
  ...props
}: CommonProps &
  ButtonHTMLAttributes<HTMLButtonElement> & {
    href?: string;
    light?: boolean;
  }) {
  const classes = cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap border px-8 py-4 text-xs font-semibold uppercase tracking-[0.2em] transition-all duration-300 active:scale-[0.98]",
    light
      ? "border-hotel-white/40 text-hotel-white hover:border-hotel-white hover:bg-hotel-white/10"
      : "border-hotel-black/30 text-hotel-black hover:border-hotel-black hover:bg-hotel-black/5",
    className,
  );

  if (href) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}

export function TextLink({
  children,
  className,
  href = "#",
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      className={cn(
        "gold-underline inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-hotel-gold transition-colors hover:text-hotel-champagne",
        className,
      )}
    >
      {children}
    </a>
  );
}
