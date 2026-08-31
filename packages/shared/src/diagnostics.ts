// Phase: lab-diagnostics-foundation (Task 3 — catalog API rewrite).
//
// Shared DTOs + Zod query-param schemas for the public lab/diagnostics
// catalog endpoints. Lives in @healthcare/shared so the marketing web
// + mobile apps can import the same shapes the API emits. Migration
// 0076 (Task 1) added the lab_diagnostic_test_categories,
// lab_diagnostic_tests, and enrichment columns (short_name / code /
// synonyms / etc.) the DTOs map onto.

import { z } from "zod";

// ─── Category DTO ────────────────────────────────────────

export interface DiagnosticCategoryDTO {
  id: string;
  slug: string;
  name: string;
  name_si?: string | null;
  name_ta?: string | null;
  icon?: string | null;
  displayOrder: number;
}

// ─── Lab availability DTO (per-laboratory row joined onto a test) ──

export interface LabAvailabilityDTO {
  labId: string;
  labName: string;
  price: number;
  discountPrice: number | null;
  currency: string;
  homeCollectionAvailable: boolean;
  labCollectionAvailable: boolean;
  turnaroundHours: number | null;
}

// ─── Diagnostic test DTO ────────────────────────────────

export interface DiagnosticTestDTO {
  id: string;
  slug: string;
  name: string;
  shortName?: string | null;
  code?: string | null;
  categorySlug: string | null;
  description?: string | null;
  sampleType: string | null;
  fastingRequired: boolean;
  fastingHours: number | null;
  homeCollectionAvailable: boolean;
  labCollectionAvailable: boolean;
  turnaroundHours: number | null;
  instructions: string | null;
  resultInterpretation: string | null;
  referenceInfo: string | null;
  visibility: "public" | "internal";
  isBookable: boolean;
  isDoctorOrderable: boolean;
  synonyms: string[];
  minPrice: number;
  currency: string;
  availableAt: LabAvailabilityDTO[];
  laboratoryCount: number;
}

// ─── Package item DTO (single test inside a package) ─────

export interface PackageItemDTO {
  testSlug: string;
  testName: string;
  displayOrder: number;
}

// ─── Package DTO ────────────────────────────────────────

export interface TestPackageDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  categorySlug: string | null;
  preparation: string | null;
  fastingRequired: boolean;
  sampleType: string | null;
  imageUrl: string | null;
  price: number;
  discountPrice: number | null;
  discountPercent: number | null;
  currency: string;
  popular: boolean;
  featured: boolean;
  displayOrder: number;
  tests: PackageItemDTO[];
  testCount: number;
  laboratoryCount: number;
}

// ─── Zod query-param schemas ────────────────────────────
//
// Mirrors the DTO shapes for the bits clients send as querystring
// payloads. Kept narrow (no body validation) — body schemas for
// /book, /bookings/:id etc. live in apps/api/src/lib/validators.ts.

export const catalogQuerySchema = z.object({
  q: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  isBookable: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  homeCollection: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  sampleType: z
    .enum(["blood", "urine", "stool", "saliva", "swab", "other"])
    .optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  sort: z.enum(["price", "popular", "name"]).optional().default("popular"),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const testSlugParamsSchema = z.object({
  slug: z.string().min(1).max(200),
});

export const packageSlugParamsSchema = z.object({
  slug: z.string().min(1).max(200),
});

export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
export type TestSlugParams = z.infer<typeof testSlugParamsSchema>;
export type PackageSlugParams = z.infer<typeof packageSlugParamsSchema>;

// ─── Response envelopes ────────────────────────────────

export interface CatalogListResponse {
  items: DiagnosticTestDTO[];
  nextCursor: string | null;
}

export interface PackageListResponse {
  items: TestPackageDTO[];
  nextCursor: string | null;
}

// ─── Lab-side catalog management (Phase 4 / Task 4) ─────
//
// Body shapes that the lab partner portal accepts when enabling,
// updating, bulk-toggling tests against the canonical catalog.

export interface EnableTestInput {
  testId: string;
  price: number;
  discountPrice?: number;
  currency?: string;
  homeCollectionAvailable?: boolean;
  labCollectionAvailable?: boolean;
  turnaroundHours?: number;
  specialInstructions?: string;
}

export interface UpdateCatalogInput {
  price?: number;
  discountPrice?: number | null;
  homeCollectionAvailable?: boolean;
  labCollectionAvailable?: boolean;
  turnaroundHours?: number | null;
  specialInstructions?: string | null;
  isActive?: boolean;
}

export interface BulkToggleInput {
  testIds: string[];
  enabled: boolean;
  price?: number;
  currency?: string;
}

export interface LabCatalogRowDTO extends LabAvailabilityDTO {
  testSlug: string;
  testName: string;
  testCode: string | null;
  lastToggledAt: string;
}

export interface LabCatalogListResponse {
  items: LabCatalogRowDTO[];
}

export const enableTestSchema = z.object({
  testId: z.string().min(1).max(80),
  price: z.number().positive(),
  discountPrice: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  homeCollectionAvailable: z.boolean().optional(),
  labCollectionAvailable: z.boolean().optional(),
  turnaroundHours: z.number().int().positive().optional(),
  specialInstructions: z.string().max(1000).optional(),
});

export const updateCatalogSchema = z.object({
  price: z.number().positive().optional(),
  discountPrice: z.number().nonnegative().nullable().optional(),
  homeCollectionAvailable: z.boolean().optional(),
  labCollectionAvailable: z.boolean().optional(),
  turnaroundHours: z.number().int().positive().nullable().optional(),
  specialInstructions: z.string().max(1000).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const bulkToggleSchema = z.object({
  testIds: z.array(z.string().min(1).max(80)).min(1).max(500),
  enabled: z.boolean(),
  price: z.number().positive().optional(),
  currency: z.string().length(3).optional(),
});

export type EnableTestBody = z.infer<typeof enableTestSchema>;
export type UpdateCatalogBody = z.infer<typeof updateCatalogSchema>;
export type BulkToggleBody = z.infer<typeof bulkToggleSchema>;