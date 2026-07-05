import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Tailwind-aware class composition. Mirrors shadcn/ui's helper.
 *
 * `clsx` resolves conditional class arrays; `twMerge` collapses conflicting
 * Tailwind classes so the later one wins (e.g. `cn("px-2", "px-4")` → "px-4").
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Cheap, deterministic-ish id for DOM keys where crypto.randomUUID isn't ideal. */
export function localId(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Sleep for ms — useful in tests / debounce flushes. */
export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}