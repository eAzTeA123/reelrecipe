import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "quiet";
type Size = "md" | "lg" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-ink shadow-[0_1px_2px_rgba(58,38,24,0.16)] hover:bg-[#a8452c]",
  secondary:
    "bg-surface text-ink border border-line hover:border-ink-3/60 hover:bg-surface-2/60",
  ghost: "bg-transparent text-ink-2 hover:text-ink hover:bg-surface-2/70",
  quiet: "bg-surface-2 text-ink-2 hover:bg-line/70 hover:text-ink",
  danger: "bg-[#f7e3e0] text-danger hover:bg-[#f1d3ce]",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-meta rounded-ctl",
  md: "h-11 px-5 text-body rounded-ctl",
  lg: "h-[52px] px-6 text-h3 rounded-card",
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
