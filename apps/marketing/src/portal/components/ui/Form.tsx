import {
  forwardRef,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/portal/lib/utils";

const inputBase =
  "w-full rounded-xl border border-border/80 bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted transition-all duration-200 focus-ring focus:border-brand/40 focus:ring-2 focus:ring-brand/10 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed hover:border-border-strong/60";

interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, required, className, children }: FieldShellProps) {
  if (!label && !hint && !error) {
    return <>{children}</>;
  }
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label className="text-xs font-semibold text-text-soft flex items-center gap-1">
          {label}
          {required ? <span className="text-danger">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <div className="text-xs text-danger flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-danger inline-block" />
          {error}
        </div>
      ) : hint ? (
        <div className="text-xs text-text-muted">{hint}</div>
      ) : null}
    </div>
  );
}

interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, wrapperClassName, label, hint, error, required, ...rest },
  ref
) {
  const input = (
    <input
      ref={ref}
      className={cn(inputBase, className)}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    />
  );
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {input}
    </FieldShell>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, wrapperClassName, label, hint, error, required, ...rest },
  ref
) {
  const ta = (
    <textarea
      ref={ref}
      className={cn(inputBase, "min-h-[88px] resize-y", className)}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    />
  );
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {ta}
    </FieldShell>
  );
});

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  wrapperClassName?: string;
  options?: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, wrapperClassName, label, hint, error, required, options, children, ...rest },
  ref
) {
  const sel = (
    <select
      ref={ref}
      className={cn(inputBase, "pr-8", className)}
      aria-invalid={error ? true : undefined}
      required={required}
      {...rest}
    >
      {options?.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      )) ?? children}
    </select>
  );
  return (
    <FieldShell label={label} hint={hint} error={error} required={required} className={wrapperClassName}>
      {sel}
    </FieldShell>
  );
});

/** Re-export for backwards-compat (rare direct usage). */
export function Field({
  label,
  hint,
  error,
  required,
  htmlFor,
  className,
  children,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-xs font-semibold text-text-soft flex items-center gap-1"
      >
        {label}
        {required ? <span className="text-danger">*</span> : null}
      </label>
      {children}
      {error ? (
        <div className="text-xs text-danger flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-danger inline-block" />
          {error}
        </div>
      ) : hint ? (
        <div className="text-xs text-text-muted">{hint}</div>
      ) : null}
    </div>
  );
}
