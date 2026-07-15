import { type ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[var(--duos-accent)] text-white shadow-[var(--shadow-soft)] hover:brightness-105 active:brightness-95",
  secondary:
    "bg-[var(--duos-surface)] text-[var(--duos-ink)] border border-[var(--duos-border)] shadow-sm hover:bg-[var(--duos-surface-raised)]",
  ghost:
    "bg-transparent text-[var(--duos-ink-muted)] hover:bg-[var(--duos-surface)] hover:text-[var(--duos-ink)]",
  success:
    "bg-[var(--duos-success)] text-white shadow-[var(--shadow-soft)] hover:brightness-105",
  danger: "bg-[var(--duos-danger)] text-white hover:brightness-105",
};

const sizeClasses: Record<Size, string> = {
  sm: "min-h-10 px-4 py-2 text-sm rounded-xl",
  md: "min-h-11 px-5 py-2.5 text-sm rounded-2xl",
  lg: "min-h-12 px-6 py-3 text-base rounded-2xl",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", fullWidth, className = "", children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 font-semibold transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--duos-accent)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
});
