#!/usr/bin/env bun
// Phase INS-MKT: seed 6 providers + 12 plans into the marketplace.
//
// Each provider gets a deterministic UUID via MD5(name) and an
// operator_orgs row first (foreign-key target). Plans reference the
// provider by id.
//
// Usage (from apps/api):
//   bun run scripts/seed-insurance-marketplace.ts [--remote]
//
// `--remote` pushes to the production D1; default is --local.

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";

function deterministicId(seed: string): string {
  const hash = createHash("md5").update(seed).digest("hex");
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32),
  ].join("-");
}

const NOW = new Date().toISOString();

type PlanSeed = {
  slug: string;
  name: string;
  planType:
    | "individual"
    | "family_floater"
    | "senior"
    | "critical_illness"
    | "cancer"
    | "dental"
    | "maternity";
  coverageSummaryLkr: number;
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  annualDiscountPct: number;
  copayPct: number;
  networkHospitalCount: number;
  waitingPeriodDays: number;
  isFeatured: boolean;
};

type ProviderSeed = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  regulatorLicense: string;
  claimSettlementRatioPct: number;
  cashlessHospitalCount: number;
  websiteUrl: string;
  supportPhone: string;
  ratingAvg: number;
  ratingCount: number;
  plans: PlanSeed[];
};

const PROVIDERS: ProviderSeed[] = [
  {
    slug: "ceylinco-insurance",
    name: "Ceylinco Insurance",
    tagline: "Sri Lanka's most trusted insurer since 1987",
    description:
      "Family-owned insurer covering 1.2M+ Sri Lankans. Strong hospital network across the island.",
    regulatorLicense: "IRSL/INS/001",
    claimSettlementRatioPct: 97,
    cashlessHospitalCount: 220,
    websiteUrl: "https://ceylinco.lk",
    supportPhone: "+94112345678",
    ratingAvg: 4.7,
    ratingCount: 1820,
    plans: [
      {
        slug: "ceylinco-health-individual",
        name: "Health Individual",
        planType: "individual",
        coverageSummaryLkr: 2_500_000,
        monthlyPremiumLkr: 3200,
        annualPremiumLkr: 35_000,
        annualDiscountPct: 8,
        copayPct: 10,
        networkHospitalCount: 220,
        waitingPeriodDays: 30,
        isFeatured: true,
      },
      {
        slug: "ceylinco-family-floater",
        name: "Family Floater Plus",
        planType: "family_floater",
        coverageSummaryLkr: 7_500_000,
        monthlyPremiumLkr: 7800,
        annualPremiumLkr: 85_000,
        annualDiscountPct: 9,
        copayPct: 15,
        networkHospitalCount: 220,
        waitingPeriodDays: 30,
        isFeatured: true,
      },
    ],
  },
  {
    slug: "union-assurance",
    name: "Union Assurance",
    tagline: "Trusted by 850,000+ Sri Lankan families",
    description:
      "Part of the John Keells Group, Union Assurance combines tech-driven claims with personal service.",
    regulatorLicense: "IRSL/INS/002",
    claimSettlementRatioPct: 95,
    cashlessHospitalCount: 180,
    websiteUrl: "https://unionassurance.lk",
    supportPhone: "+94112456789",
    ratingAvg: 4.5,
    ratingCount: 940,
    plans: [
      {
        slug: "ua-senior-care",
        name: "Senior Care 60+",
        planType: "senior",
        coverageSummaryLkr: 5_000_000,
        monthlyPremiumLkr: 6500,
        annualPremiumLkr: 72_000,
        annualDiscountPct: 8,
        copayPct: 20,
        networkHospitalCount: 180,
        waitingPeriodDays: 60,
        isFeatured: false,
      },
      {
        slug: "ua-critical-illness-shield",
        name: "Critical Illness Shield",
        planType: "critical_illness",
        coverageSummaryLkr: 3_000_000,
        monthlyPremiumLkr: 4200,
        annualPremiumLkr: 46_000,
        annualDiscountPct: 8,
        copayPct: 0,
        networkHospitalCount: 90,
        waitingPeriodDays: 90,
        isFeatured: false,
      },
    ],
  },
  {
    slug: "aia-insurance-lanka",
    name: "AIA Insurance Lanka",
    tagline: "Healthier, longer, better lives",
    description:
      "AIA is the largest publicly listed insurance group in Asia. Now serving Sri Lanka with global expertise.",
    regulatorLicense: "IRSL/INS/003",
    claimSettlementRatioPct: 96,
    cashlessHospitalCount: 260,
    websiteUrl: "https://aia.lk",
    supportPhone: "+94112567890",
    ratingAvg: 4.6,
    ratingCount: 2100,
    plans: [
      {
        slug: "aia-healthy-individual",
        name: "Healthy Me",
        planType: "individual",
        coverageSummaryLkr: 3_000_000,
        monthlyPremiumLkr: 3800,
        annualPremiumLkr: 42_000,
        annualDiscountPct: 8,
        copayPct: 10,
        networkHospitalCount: 260,
        waitingPeriodDays: 30,
        isFeatured: true,
      },
      {
        slug: "aia-cancer-care",
        name: "Cancer Care Complete",
        planType: "cancer",
        coverageSummaryLkr: 8_000_000,
        monthlyPremiumLkr: 8400,
        annualPremiumLkr: 92_000,
        annualDiscountPct: 9,
        copayPct: 0,
        networkHospitalCount: 80,
        waitingPeriodDays: 60,
        isFeatured: false,
      },
    ],
  },
  {
    slug: "hnb-assurance",
    name: "HNB Assurance",
    tagline: "Your family, our commitment",
    description:
      "Backed by Hatton National Bank — seamless integration with your HNB accounts.",
    regulatorLicense: "IRSL/INS/004",
    claimSettlementRatioPct: 93,
    cashlessHospitalCount: 150,
    websiteUrl: "https://hnbassurance.lk",
    supportPhone: "+94112678901",
    ratingAvg: 4.3,
    ratingCount: 620,
    plans: [
      {
        slug: "hnb-health-family",
        name: "Health Family",
        planType: "family_floater",
        coverageSummaryLkr: 6_000_000,
        monthlyPremiumLkr: 6500,
        annualPremiumLkr: 71_000,
        annualDiscountPct: 9,
        copayPct: 15,
        networkHospitalCount: 150,
        waitingPeriodDays: 30,
        isFeatured: false,
      },
      {
        slug: "hnb-maternity-care",
        name: "Maternity Care Plan",
        planType: "maternity",
        coverageSummaryLkr: 1_500_000,
        monthlyPremiumLkr: 2400,
        annualPremiumLkr: 26_000,
        annualDiscountPct: 8,
        copayPct: 0,
        networkHospitalCount: 90,
        waitingPeriodDays: 365,
        isFeatured: false,
      },
    ],
  },
  {
    slug: "softlogic-life",
    name: "Softlogic Life Insurance",
    tagline: "Innovative insurance for modern Sri Lanka",
    description:
      "Tech-forward insurer with one of the fastest mobile claims processes in the country.",
    regulatorLicense: "IRSL/INS/005",
    claimSettlementRatioPct: 94,
    cashlessHospitalCount: 130,
    websiteUrl: "https://softiclife.lk",
    supportPhone: "+94112789012",
    ratingAvg: 4.4,
    ratingCount: 480,
    plans: [
      {
        slug: "softlogic-digital-health",
        name: "Digital Health",
        planType: "individual",
        coverageSummaryLkr: 2_000_000,
        monthlyPremiumLkr: 2900,
        annualPremiumLkr: 32_000,
        annualDiscountPct: 7,
        copayPct: 10,
        networkHospitalCount: 130,
        waitingPeriodDays: 30,
        isFeatured: false,
      },
      {
        slug: "softlogic-dental-plus",
        name: "Dental Plus",
        planType: "dental",
        coverageSummaryLkr: 600_000,
        monthlyPremiumLkr: 1200,
        annualPremiumLkr: 13_000,
        annualDiscountPct: 7,
        copayPct: 20,
        networkHospitalCount: 60,
        waitingPeriodDays: 30,
        isFeatured: false,
      },
    ],
  },
  {
    slug: "continental-insurance",
    name: "Continental Insurance",
    tagline: "Reliable coverage since 1962",
    description:
      "One of the oldest insurers in Sri Lanka with deep expertise in personal lines.",
    regulatorLicense: "IRSL/INS/006",
    claimSettlementRatioPct: 92,
    cashlessHospitalCount: 110,
    websiteUrl: "https://continental.lk",
    supportPhone: "+94112890123",
    ratingAvg: 4.2,
    ratingCount: 380,
    plans: [
      {
        slug: "continental-essential-individual",
        name: "Essential Individual",
        planType: "individual",
        coverageSummaryLkr: 1_500_000,
        monthlyPremiumLkr: 2100,
        annualPremiumLkr: 23_000,
        annualDiscountPct: 7,
        copayPct: 20,
        networkHospitalCount: 110,
        waitingPeriodDays: 30,
        isFeatured: false,
      },
      {
        slug: "continental-critical-cover",
        name: "Critical Cover 360",
        planType: "critical_illness",
        coverageSummaryLkr: 4_000_000,
        monthlyPremiumLkr: 5300,
        annualPremiumLkr: 58_000,
        annualDiscountPct: 8,
        copayPct: 0,
        networkHospitalCount: 70,
        waitingPeriodDays: 90,
        isFeatured: false,
      },
    ],
  },
];

const stmts: string[] = [];

// Ensure operator_orgs rows for each provider (foreign-key target).
// operator_orgs schema (migration 0047): id, name, kind, contact_email,
// contact_phone, status, created_at — no slug, no updated_at.
for (const p of PROVIDERS) {
  const orgId = deterministicId(`org:${p.slug}`);
  stmts.push(
    `INSERT OR IGNORE INTO operator_orgs (id, name, kind, contact_phone, status, created_at) VALUES ('${orgId}', '${p.name.replace(/'/g, "''")}', 'insurance', '${p.supportPhone}', 'active', '${NOW}');`,
  );
}

// Upsert providers.
for (const p of PROVIDERS) {
  const providerId = deterministicId(`ins:${p.slug}`);
  const orgId = deterministicId(`org:${p.slug}`);
  stmts.push(
    `INSERT INTO insurance_providers (id, operator_org_id, slug, name, tagline, description, regulator_license, claim_settlement_ratio_pct, cashless_hospital_count, website_url, support_phone, rating_avg, rating_count, is_published, created_at, updated_at) VALUES ('${providerId}', '${orgId}', '${p.slug}', '${p.name.replace(/'/g, "''")}', '${p.tagline.replace(/'/g, "''")}', '${p.description.replace(/'/g, "''")}', '${p.regulatorLicense}', ${p.claimSettlementRatioPct}, ${p.cashlessHospitalCount}, '${p.websiteUrl}', '${p.supportPhone}', ${p.ratingAvg}, ${p.ratingCount}, 1, '${NOW}', '${NOW}') ON CONFLICT(slug) DO UPDATE SET name=excluded.name, tagline=excluded.tagline, description=excluded.description, claim_settlement_ratio_pct=excluded.claim_settlement_ratio_pct, cashless_hospital_count=excluded.cashless_hospital_count, rating_avg=excluded.rating_avg, rating_count=excluded.rating_count, updated_at=excluded.updated_at;`,
  );

  for (const plan of p.plans) {
    const planId = deterministicId(`plan:${plan.slug}`);
    stmts.push(
      `INSERT INTO insurance_plans (id, provider_id, slug, name, plan_type, coverage_summary_lkr, monthly_premium_lkr, annual_premium_lkr, annual_discount_pct, copay_pct, network_hospital_count, waiting_period_days, is_published, is_featured, term_months, deductible_lkr, created_at, updated_at) VALUES ('${planId}', '${providerId}', '${plan.slug}', '${plan.name.replace(/'/g, "''")}', '${plan.planType}', ${plan.coverageSummaryLkr}, ${plan.monthlyPremiumLkr}, ${plan.annualPremiumLkr}, ${plan.annualDiscountPct}, ${plan.copayPct}, ${plan.networkHospitalCount}, ${plan.waitingPeriodDays}, 1, ${plan.isFeatured ? 1 : 0}, 12, 0, '${NOW}', '${NOW}') ON CONFLICT(provider_id, slug) DO UPDATE SET name=excluded.name, plan_type=excluded.plan_type, coverage_summary_lkr=excluded.coverage_summary_lkr, monthly_premium_lkr=excluded.monthly_premium_lkr, annual_premium_lkr=excluded.annual_premium_lkr, annual_discount_pct=excluded.annual_discount_pct, copay_pct=excluded.copay_pct, network_hospital_count=excluded.network_hospital_count, waiting_period_days=excluded.waiting_period_days, is_featured=excluded.is_featured, updated_at=excluded.updated_at;`,
    );
  }
}

const dir = mkdtempSync(join(tmpdir(), "ins-seed-"));
const file = join(dir, "seed-insurance-marketplace.sql");
writeFileSync(file, stmts.join("\n") + "\n");
console.log(`Wrote ${stmts.length} SQL statements → ${file}`);

const isRemote = process.argv.includes("--remote");
const args = [
  "wrangler",
  "d1",
  "execute",
  "healthcare-db",
  "--file",
  file,
];
if (isRemote) args.push("--remote");

const r = spawnSync("bunx", args, { stdio: "inherit" });
if (r.status !== 0) {
  console.error("wrangler d1 execute failed");
  process.exit(r.status ?? 1);
}

console.log(
  `Seeded ${PROVIDERS.length} providers + ${PROVIDERS.reduce((n, p) => n + p.plans.length, 0)} plans.`,
);
