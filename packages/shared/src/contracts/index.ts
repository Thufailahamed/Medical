/**
 * Cross-platform API contracts for the patient surface.
 *
 * Each domain module exports three things and nothing else:
 *   - path builders    — the endpoint strings, built once
 *   - types            — the shapes the API actually returns
 *   - (keys.ts only)   — the React Query key factories
 *
 * No fetch logic, no React, no platform imports. Web hooks and Expo hooks
 * both import from here so that a drift between the two platforms becomes
 * a typecheck error rather than a runtime bug.
 */

export * from "./keys";
export * from "./types";
