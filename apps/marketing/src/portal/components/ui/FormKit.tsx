"use client";

import {
  forwardRef,
  useId,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import {
  Controller,
  FormProvider,
  useForm,
  useFormContext,
  type FieldErrors,
  type FieldValues,
  type UseFormProps,
  type UseFormReturn,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z, ZodTypeAny } from "zod";

import { cn } from "@/portal/lib/utils";

// ----------------------------------------------------------------------------
// RHFFormProvider
// ----------------------------------------------------------------------------

type ProviderProps<S extends ZodTypeAny> = Omit<UseFormProps<z.infer<S>>, "resolver"> & {
  schema: S;
  children: (form: UseFormReturn<z.infer<S>>) => ReactNode;
};

/**
 * Wires up `useForm` + `zodResolver`, exposes the form handle via render-prop.
 *
 *   <RHFFormProvider schema={formSchema} defaultValues={...}>
 *     {(form) => (
 *       <form onSubmit={form.handleSubmit(onSubmit)}>
 *         <RHFInput name="foo" label="Foo" />
 *         <button>Submit</button>
 *       </form>
 *     )}
 *   </RHFFormProvider>
 */
export function RHFFormProvider<S extends ZodTypeAny>({
  schema,
  children,
  ...rest
}: ProviderProps<S>) {
  const methods = useForm<z.infer<S>>({
    resolver: zodResolver(schema),
    ...(rest as UseFormProps<z.infer<S>>),
  });
  return <FormProvider {...methods}>{children(methods)}</FormProvider>;
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function getError<T extends FieldValues>(
  errors: FieldErrors<T>,
  name: string
): string | undefined {
  const parts = name.split(".");
  let cur: unknown = errors;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  if (!cur || typeof cur !== "object") return undefined;
  if (typeof cur === "string") return cur;
  const curObj = cur as { message?: unknown };
  if (typeof curObj.message === "string") return curObj.message;
  return undefined;
}

// ----------------------------------------------------------------------------
// FieldShell — shared label/hint/error layout
// ----------------------------------------------------------------------------

interface FieldShellProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
  children: ReactNode;
}

function FieldShell({ label, hint, error, required, className, children }: FieldShellProps) {
  if (!label && !hint && !error) return <>{children}</>;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label ? (
        <label className="portal-field-label flex items-center gap-1">
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

const inputBase =
  "portal-input focus-ring disabled:opacity-50 disabled:cursor-not-allowed";

// ----------------------------------------------------------------------------
// RHFInput
// ----------------------------------------------------------------------------

interface RHFInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue"> {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  wrapperClassName?: string;
}

export const RHFInput = forwardRef<HTMLInputElement, RHFInputProps>(function RHFInput(
  { name, label, hint, wrapperClassName, className, required, ...rest },
  _
) {
  const form = useFormContext();
  const error = getError<FieldValues>(form.formState.errors, name);
  const id = useId();
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <FieldShell
          label={label ? <label htmlFor={id}>{label}</label> : undefined}
          hint={hint}
          error={error}
          required={required}
          className={wrapperClassName}
        >
          <input
            id={id}
            className={cn(inputBase, className)}
            aria-invalid={error ? true : undefined}
            ref={field.ref}
            name={field.name}
            value={(field.value as string | number | undefined) ?? ""}
            onChange={field.onChange}
            onBlur={field.onBlur}
            required={required}
            {...rest}
          />
        </FieldShell>
      )}
    />
  );
});

// ----------------------------------------------------------------------------
// RHFTextarea
// ----------------------------------------------------------------------------

interface RHFTextareaProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "defaultValue"> {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  wrapperClassName?: string;
}

export const RHFTextarea = forwardRef<HTMLTextAreaElement, RHFTextareaProps>(
  function RHFTextarea(
    { name, label, hint, wrapperClassName, className, required, ...rest },
    _
  ) {
    const form = useFormContext();
    const error = getError<FieldValues>(form.formState.errors, name);
    const id = useId();
    return (
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <FieldShell
            label={label ? <label htmlFor={id}>{label}</label> : undefined}
            hint={hint}
            error={error}
            required={required}
            className={wrapperClassName}
          >
            <textarea
              id={id}
              className={cn(inputBase, "min-h-[88px] resize-y", className)}
              aria-invalid={error ? true : undefined}
              ref={field.ref}
              name={field.name}
              value={(field.value as string | undefined) ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              required={required}
              {...rest}
            />
          </FieldShell>
        )}
      />
    );
  }
);

// ----------------------------------------------------------------------------
// RHFSelect
// ----------------------------------------------------------------------------

interface RHFSelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "name" | "defaultValue"> {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  wrapperClassName?: string;
  options?: Array<{ value: string; label: string }>;
}

export const RHFSelect = forwardRef<HTMLSelectElement, RHFSelectProps>(
  function RHFSelect(
    { name, label, hint, wrapperClassName, className, required, options, children, ...rest },
    _
  ) {
    const form = useFormContext();
    const error = getError<FieldValues>(form.formState.errors, name);
    const id = useId();
    return (
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <FieldShell
            label={label ? <label htmlFor={id}>{label}</label> : undefined}
            hint={hint}
            error={error}
            required={required}
            className={wrapperClassName}
          >
            <select
              id={id}
              className={cn(inputBase, "pr-8", className)}
              aria-invalid={error ? true : undefined}
              ref={field.ref}
              name={field.name}
              value={(field.value as string | undefined) ?? ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              required={required}
              {...rest}
            >
              {options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              )) ?? children}
            </select>
          </FieldShell>
        )}
      />
    );
  }
);

// ----------------------------------------------------------------------------
// RHFCheckbox
// ----------------------------------------------------------------------------

interface RHFCheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "name" | "defaultValue" | "type"> {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  wrapperClassName?: string;
}

export function RHFCheckbox({
  name,
  label,
  hint,
  wrapperClassName,
  className,
  required,
  ...rest
}: RHFCheckboxProps) {
  const form = useFormContext();
  const error = getError<FieldValues>(form.formState.errors, name);
  const id = useId();
  return (
    <Controller
      control={form.control}
      name={name}
      render={({ field }) => (
        <FieldShell
          label={undefined}
          hint={hint}
          error={error}
          required={required}
          className={wrapperClassName}
        >
          <label htmlFor={id} className="inline-flex items-center gap-2 cursor-pointer text-sm">
            <input
              id={id}
              type="checkbox"
              className={cn("h-4 w-4 rounded border-border", className)}
              ref={field.ref}
              name={field.name}
              checked={Boolean(field.value)}
              onChange={(e) => field.onChange(e.target.checked)}
              onBlur={field.onBlur}
              required={required}
              {...rest}
            />
            <span>{label}</span>
          </label>
        </FieldShell>
      )}
    />
  );
}

// ----------------------------------------------------------------------------
// SubmitButton — disables while submitting
// ----------------------------------------------------------------------------

interface SubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: ReactNode;
}

export function SubmitButton({
  loading,
  loadingLabel,
  children,
  className,
  ...rest
}: SubmitProps) {
  const form = useFormContext();
  const submitting = loading ?? form.formState.isSubmitting;
  return (
    <button
      type="submit"
      disabled={submitting || rest.disabled}
      className={cn("portal-btn portal-btn-primary", className)}
      {...rest}
    >
      {submitting ? (loadingLabel ?? children) : children}
    </button>
  );
}

/** Re-export for direct use. */
export function handleRHFSubmit<S extends ZodTypeAny>(
  form: UseFormReturn<z.infer<S>>,
  onSubmit: (values: z.infer<S>) => void | Promise<void>
) {
  return form.handleSubmit(async (values) => {
    await onSubmit(values);
  });
}

/** Type-safe onSubmit alias. */
export function onValid<S extends ZodTypeAny>(
  form: UseFormReturn<z.infer<S>>,
  handler: (values: z.infer<S>) => void | Promise<void>
) {
  return form.handleSubmit(handler);
}

/** Convert native form event → RHF submit. */
export function onSubmitForm<S extends ZodTypeAny>(
  form: UseFormReturn<z.infer<S>>,
  handler: (values: z.infer<S>) => void | Promise<void>
) {
  return (e: FormEvent) => {
    e.preventDefault();
    return form.handleSubmit(handler)().catch(() => {
      /* errors surfaced via formState */
    });
  };
}
