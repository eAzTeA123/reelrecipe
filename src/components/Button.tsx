import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "md" | "lg" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-card hover:bg-accent-hover",
  secondary: "bg-surface text-ink border border-line hover:border-line-2 hover:bg-surface-2",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2 hover:text-ink",
  quiet: "bg-surface-2 text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-danger/10 text-danger hover:bg-danger/15",
};

/*
 * Höhen als min-h: die Fläche darf bei langen Beschriftungen wachsen, bleibt
 * aber immer über der 44-px-Daumenregel.
 */
const sizes: Record<Size, string> = {
  sm: "min-h-11 px-4 text-meta rounded-ctl",
  md: "min-h-[52px] px-5 text-body rounded-ctl",
  lg: "min-h-14 px-6 text-h3 rounded-card",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", fullWidth, type = "button", className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={[
        "pressable inline-flex items-center justify-center gap-2 font-semibold",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        "disabled:opacity-45 disabled:pointer-events-none select-none",
        variants[variant],
        sizes[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    />
  );
});
