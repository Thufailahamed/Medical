"use client";

/**
 * Local form wrappers around the portal UI primitives. The portal's
 * `Form` module exports `Input`/`Textarea`/`Select`/`Field` but no
 * top-level `<Form>` shell, so the hospital portal uses these thin
 * wrappers for ergonomic call sites.
 */

import type { FormEventHandler, ReactNode } from "react";
import { Field } from "@/portal/components/ui/Form";
import { cn } from "@/hospital/lib/utils";

export function Form({
  onSubmit,
  className,
  children,
}: {
  onSubmit?: FormEventHandler<HTMLFormElement>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <form onSubmit={onSubmit} className={cn("space-y-4", className)}>
      {children}
    </form>
  );
}

export function FormField({
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Field label={label} required={required} hint={hint} error={error} className={className}>
      {children}
    </Field>
  );
}