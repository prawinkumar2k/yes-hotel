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
    "inline-flex items-center justify-center gap-2 whitespace-nowrap min-h-[44px] bg-hotel-gold px-6 py-3.5 text-xs font-bold uppercase tracking-[0.2em] text-black transition-all duration-300 hover:bg-amber-600 hover:text-white active:scale-[0.98] sm:px-8 sm:py-4 shadow-sm",
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
    "inline-flex items-center justify-center gap-2 whitespace-nowrap min-h-[44px] border-2 px-6 py-3.5 text-xs font-bold uppercase tracking-[0.2em] transition-all duration-300 active:scale-[0.98] sm:px-8 sm:py-4 shadow-xs",
    light
      ? "border-white bg-black/40 text-white hover:border-white hover:bg-white hover:text-black font-bold"
      : "border-black bg-white text-black hover:bg-black hover:text-white font-bold",
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
