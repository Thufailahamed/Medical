"use client";

import { ApiError } from "./api";

/**
 * Friendly message extractor for thrown API errors. The server returns
 * either:
 *   { error: "Human message" }
 *   { error: "Validation failed", details: [{ message: "..." }] }
 *   { details: { formErrors, fieldErrors } }   ← zod flatten
 */
export function friendlyError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.details && typeof err.details === "object") {
      const d = err.details as any;
      if (Array.isArray(d)) {
        const first = d[0]?.message;
        if (first) return first;
      } else if (Array.isArray(d.details)) {
        const first = d.details[0]?.message;
        if (first) return first;
      } else if (d.fieldErrors) {
        const firstField = Object.keys(d.fieldErrors)[0];
        if (firstField) {
          const msg = (d.fieldErrors as any)[firstField]?.[0];
          if (msg) return `${firstField}: ${msg}`;
        }
      }
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}