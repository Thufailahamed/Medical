import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware class composition helper used throughout the hospital
 * portal. Mirrors the portal's `cn()` so component code reads the same.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Cheap deterministic-ish id for DOM keys. */
export function localId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Sleep helper used by debounce flushes in tests. */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}