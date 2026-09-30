import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

const baseClass =
  "w-full rounded-ctl border border-line bg-surface px-4 text-[16px] text-ink " +
  "placeholder:text-ink-3 focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/20 " +
  "transition-colors disabled:opacity-50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`${baseClass} h-12 ${className}`} {...props} />;
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className = "", ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={`${baseClass} py-3 min-h-28 resize-y leading-relaxed ${className}`}
      {...props}
    />
  );
});

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-meta font-semibold text-ink-2">
        {label}
      </label>
      {children}
      {hint && <p className="text-meta text-ink-3">{hint}</p>}
    </div>
  );
}
