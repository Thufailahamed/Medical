"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/portal/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  block?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 focus-ring select-none disabled:opacity-50 disabled:pointer-events-none active:scale-[0.97]";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-strong shadow-[0_2px_8px_rgba(2,132,199,0.25)] hover:shadow-[0_4px_16px_rgba(2,132,199,0.35)]",
  secondary:
    "bg-surface text-text border border-border/80 hover:bg-surface-2 hover:border-border hover:shadow-sm",
  ghost: "bg-transparent text-text-soft hover:bg-surface-2/60 hover:text-text active:bg-surface-2",
  danger:
    "bg-danger text-white hover:bg-red-700 shadow-[0_2px_8px_rgba(220,38,38,0.25)] hover:shadow-[0_4px_16px_rgba(220,38,38,0.35)]",
  link: "bg-transparent text-brand hover:underline underline-offset-2 px-0",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-xs",
  md: "h-9 px-5 text-sm",
  lg: "h-11 px-6 text-sm",
  icon: "h-9 w-9 p-0",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading,
    leftIcon,
    rightIcon,
    block,
    className,
    disabled,
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(
        base,
        variants[variant],
        sizes[size],
        block && "w-full",
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="4"
      />
      <path
        d="M4 12a8 8 0 018-8"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
