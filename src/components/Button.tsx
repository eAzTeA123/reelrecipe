import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "lg" | "sm";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-[0_1px_2px_rgba(0,0,0,0.08)] hover:bg-[#c74530]",
  secondary: "bg-surface text-ink border border-line shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
  ghost: "bg-transparent text-ink-2",
  danger: "bg-[#fdeeec] text-danger",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-[15px] rounded-[10px]",
  md: "h-11 px-5 text-[16px] rounded-ctl",
  lg: "h-[52px] px-6 text-[17px] rounded-2xl font-semibold",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = "primary", size = "md", fullWidth, className = "", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={[
        "pressable inline-flex items-center justify-center gap-2 font-medium",
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
