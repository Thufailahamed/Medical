"use client";

/**
 * The patient hook surface.
 *
 * Hooks live in per-domain modules; this barrel is the single import
 * specifier the app and its tests use. Every page test mocks
 * `@/patient/hooks`, so this file's export list is effectively the
 * portal's internal API — see index.test.ts.
 */

export * from "./profile";
export * from "./vitals";
export * from "./records";
export * from "./timeline";
export * from "./appointments";
export * from "./medicines";
export * from "./messages";
export * from "./notifications-feed";
export * from "./allergies";
export * from "./vaccinations";
export * from "./notes";
