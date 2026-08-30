// @ts-nocheck
// Phase: lab-diagnostics-foundation (Task 2 — seed script).
//
// Idempotent seed for the lab/diagnostics v2 tables introduced by
// migration 0076. Inserts the canonical test catalog + per-lab
// availability + packages + images. Safe to re-run: every insert
// uses onConflictDoUpdate keyed on a unique column so subsequent
// runs only patch the rows.
//
// Run via:
//   bun run seed:diagnostics
//
// The seed function is exported so the test suite (MockD1) can
// invoke it without booting the full Workers runtime and without
// hitting the OSS bucket the urls.json URLs point to.

import { eq, and } from "drizzle-orm";
import {
  labDiagnosticTestCategories,
  diagnosticTestCatalog,
  testPackages,
  testPackageItems,
  labDiagnosticTests,
  users,
} from "@healthcare/db";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname, basename, extname } from "node:path";

// `main()` dynamically imports `@libsql/client` + `drizzle-orm/libsql`
// so this module loads cleanly in the vitest environment (which does
// not have those packages installed). The runtime CLI path
// (`bun run seed:diagnostics`) does install them via bun's auto-
// resolution.

// ─── Types ──────────────────────────────────────────────────

type SeedImageMap = Record<string, string>;

export type SeedOptions = {
  // slug → public URL. Tests inject a fake map; the CLI loads from urls.json.
  imageMap?: SeedImageMap;
  // Directory to write downloaded images to. Defaults to the marketing
  // public asset path; tests can override to a temp dir.
  imageOutputDir?: string;
  // When true (default for tests), skip the network fetch entirely and
  // assume every URL in imageMap resolves to a valid file. Tests use
  // this; CLI uses false.
  skipNetworkFetch?: boolean;
};

// ─── Seed data: categories ────────────────────────────────────
//
// 15 human-friendly categories from the brief + i18n names for the
// seven the brief calls out (Cardiology, Diabetes, Thyroid, Liver,
// Kidney, CBC, Pregnancy). Slugs are kept lowercase + kebab-case.

type LabDiagnosticTestCategorySeed = {
  id: string;
  slug: string;
  name: string;
  name_si?: string;
  name_ta?: string;
  icon: string;
  displayOrder: number;
  isActive: boolean;
};

const CATEGORIES: LabDiagnosticTestCategorySeed[] = [
  {
    id: "cat-cardiology",
    slug: "cardiology",
    name: "Cardiology",
    name_si: "හෘද රෝග",
    name_ta: "இதய நோய்",
    icon: "heart",
    displayOrder: 10,
    isActive: true,
  },
  {
    id: "cat-diabetes",
    slug: "diabetes",
    name: "Diabetes",
    name_si: "දියවැඩියාව",
    name_ta: "நீரிழிவு",
    icon: "droplet",
    displayOrder: 20,
    isActive: true,
  },
  {
    id: "cat-liver",
    slug: "liver",
    name: "Liver",
    name_si: "අක්මාව",
    name_ta: "கல்லீரல்",
    icon: "liver",
    displayOrder: 30,
    isActive: true,
  },
  {
    id: "cat-kidney",
    slug: "kidney",
    name: "Kidney",
    name_si: "වකුගඩු",
    name_ta: "சிறுநீரகம்",
    icon: "kidney",
    displayOrder: 40,
    isActive: true,
  },
  {
    id: "cat-thyroid",
    slug: "thyroid",
    name: "Thyroid",
    name_si: "තයිරොයිඩ්",
    name_ta: "தைராய்டு",
    icon: "thyroid",
    displayOrder: 50,
    isActive: true,
  },
  {
    id: "cat-lipid",
    slug: "lipid",
    name: "Lipid",
    icon: "lipid",
    displayOrder: 60,
    isActive: true,
  },
  {
    id: "cat-cbc",
    slug: "cbc",
    name: "CBC / Hematology",
    name_si: "සම්පූර්ණ රුධිර පරීක්ෂාව",
    name_ta: "முழு இரத்த பரிசோதனை",
    icon: "blood",
    displayOrder: 70,
    isActive: true,
  },
  {
    id: "cat-urinalysis",
    slug: "urinalysis",
    name: "Urinalysis",
    icon: "urine",
    displayOrder: 80,
    isActive: true,
  },
  {
    id: "cat-hormones",
    slug: "hormones",
    name: "Hormones",
    icon: "hormone",
    displayOrder: 90,
    isActive: true,
  },
  {
    id: "cat-vitamins",
    slug: "vitamins",
    name: "Vitamins",
    icon: "vitamin",
    displayOrder: 100,
    isActive: true,
  },
  {
    id: "cat-imaging-lab",
    slug: "imaging-lab",
    name: "Imaging-Lab",
    icon: "scan",
    displayOrder: 110,
    isActive: true,
  },
  {
    id: "cat-pregnancy",
    slug: "pregnancy",
    name: "Pregnancy",
    name_si: "ගර්භණී පරීක්ෂා",
    name_ta: "கர்ப்ப பரிசோதனை",
    icon: "pregnancy",
    displayOrder: 120,
    isActive: true,
  },
  {
    id: "cat-cancer-screening",
    slug: "cancer-screening",
    name: "Cancer Screening",
    icon: "cancer",
    displayOrder: 130,
    isActive: true,
  },
  {
    id: "cat-allergy",
    slug: "allergy",
    name: "Allergy",
    icon: "allergy",
    displayOrder: 140,
    isActive: true,
  },
  {
    id: "cat-infectious",
    slug: "infectious-disease",
    name: "Infectious Disease",
    icon: "virus",
    displayOrder: 150,
    isActive: true,
  },
];

// ─── Seed data: catalog tests ────────────────────────────────
//
// ≥40 canonical tests with codes matching the brief's vocabulary.
// `legacyCategory` is the 0062 enum value (kept for backward compat);
// `categorySlug` is the v2 lookup key.

type DiagnosticTestSeed = {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  code: string;
  categorySlug: string;
  legacyCategory:
    | "blood"
    | "urine"
    | "stool"
    | "saliva"
    | "swab"
    | "cardiac"
    | "diabetes"
    | "thyroid"
    | "liver"
    | "kidney"
    | "lipid"
    | "vitamin"
    | "hormone"
    | "cancer_marker"
    | "infection"
    | "allergy"
    | "genetic"
    | "imaging"
    | "other";
  description: string;
  sampleType: "blood" | "urine" | "stool" | "saliva" | "swab" | "other";
  fastingRequired: boolean;
  fastingHours: number;
  homeCollectionAvailable: boolean;
  labCollectionAvailable: boolean;
  price: number;
  currency: "LKR";
  turnaroundHours: number;
  instructions: string;
  resultInterpretation: string;
  referenceInfo: string;
  synonyms: string;
  isBookable: boolean;
  isDoctorOrderable: boolean;
  visibility: "public" | "internal";
  displayOrder: number;
};

const TESTS: DiagnosticTestSeed[] = [
  {
    id: "test-cbc",
    slug: "cbc",
    name: "Complete Blood Count",
    shortName: "CBC",
    code: "CBC",
    categorySlug: "cbc",
    legacyCategory: "blood",
    description: "Measures red cells, white cells, platelets, hemoglobin and hematocrit.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1200,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No special preparation required.",
    resultInterpretation: "Low hemoglobin suggests anemia; high WBC may indicate infection.",
    referenceInfo: "Adult reference ranges apply; consult report for age/sex-specific values.",
    synonyms: JSON.stringify(["Full Blood Count", "FBC", "Hemogram"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 10,
  },
  {
    id: "test-cbc-esr",
    slug: "cbc-with-esr",
    name: "CBC with ESR",
    shortName: "CBC + ESR",
    code: "CBC",
    categorySlug: "cbc",
    legacyCategory: "blood",
    description: "Complete blood count plus erythrocyte sedimentation rate.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1500,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated ESR indicates inflammation.",
    referenceInfo: "ESR < 20 mm/hr (men), < 30 mm/hr (women).",
    synonyms: JSON.stringify(["CBC + ESR"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 11,
  },
  {
    id: "test-lipid",
    slug: "lipid-profile",
    name: "Lipid Profile",
    shortName: "Lipid Profile",
    code: "LIPID",
    categorySlug: "lipid",
    legacyCategory: "lipid",
    description: "Total cholesterol, LDL, HDL, triglycerides.",
    sampleType: "blood",
    fastingRequired: true,
    fastingHours: 12,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2200,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Fast for 12 hours before sample collection.",
    resultInterpretation: "High LDL increases cardiovascular risk.",
    referenceInfo: "Total cholesterol < 200 mg/dL desirable.",
    synonyms: JSON.stringify(["Cholesterol Panel"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 20,
  },
  {
    id: "test-fbg",
    slug: "fasting-blood-glucose",
    name: "Fasting Blood Glucose",
    shortName: "FBG",
    code: "FBG",
    categorySlug: "diabetes",
    legacyCategory: "diabetes",
    description: "Measures blood glucose after fasting.",
    sampleType: "blood",
    fastingRequired: true,
    fastingHours: 8,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 600,
    currency: "LKR",
    turnaroundHours: 6,
    instructions: "Fast for 8 hours before sample collection.",
    resultInterpretation: "100-125 mg/dL = prediabetes; ≥126 mg/dL = diabetes.",
    referenceInfo: "Normal: 70-100 mg/dL fasting.",
    synonyms: JSON.stringify(["FBG", "Fasting Sugar"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 30,
  },
  {
    id: "test-hba1c",
    slug: "hba1c",
    name: "HbA1c (Glycated Haemoglobin)",
    shortName: "HbA1c",
    code: "HBA1C",
    categorySlug: "diabetes",
    legacyCategory: "diabetes",
    description: "Reflects average blood sugar over the past 2-3 months.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1800,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "<5.7% normal; 5.7-6.4% prediabetes; ≥6.5% diabetes.",
    referenceInfo: "Target <7% for most adults with diabetes.",
    synonyms: JSON.stringify(["A1c", "Glycated Haemoglobin"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 31,
  },
  {
    id: "test-ogtt",
    slug: "ogtt",
    name: "Oral Glucose Tolerance Test (OGTT)",
    shortName: "OGTT",
    code: "OGTT",
    categorySlug: "diabetes",
    legacyCategory: "diabetes",
    description: "Measures glucose response after a standardised glucose load.",
    sampleType: "blood",
    fastingRequired: true,
    fastingHours: 8,
    homeCollectionAvailable: false,
    labCollectionAvailable: true,
    price: 2400,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Fasting; 75g glucose drink provided at lab.",
    resultInterpretation: "2-hr ≥200 mg/dL = diabetes; 140-199 = prediabetes.",
    referenceInfo: "Per WHO diagnostic criteria.",
    synonyms: JSON.stringify(["Glucose Tolerance Test"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 32,
  },
  {
    id: "test-tsh",
    slug: "tsh",
    name: "Thyroid Stimulating Hormone (TSH)",
    shortName: "TSH",
    code: "TSH",
    categorySlug: "thyroid",
    legacyCategory: "thyroid",
    description: "Screens for thyroid dysfunction.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1700,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "High TSH = hypothyroidism; low TSH = hyperthyroidism.",
    referenceInfo: "Reference: 0.4-4.0 mIU/L.",
    synonyms: JSON.stringify(["TSH"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 40,
  },
  {
    id: "test-t3-free",
    slug: "t3-free",
    name: "Free T3",
    shortName: "Free T3",
    code: "T3",
    categorySlug: "thyroid",
    legacyCategory: "thyroid",
    description: "Measures unbound triiodothyronine.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1900,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated in hyperthyroidism.",
    referenceInfo: "Reference: 2.3-4.2 pg/mL.",
    synonyms: JSON.stringify(["FT3"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 41,
  },
  {
    id: "test-t4-free",
    slug: "t4-free",
    name: "Free T4",
    shortName: "Free T4",
    code: "T4",
    categorySlug: "thyroid",
    legacyCategory: "thyroid",
    description: "Measures unbound thyroxine.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1900,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated in hyperthyroidism; low in hypothyroidism.",
    referenceInfo: "Reference: 0.8-1.8 ng/dL.",
    synonyms: JSON.stringify(["FT4"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 42,
  },
  {
    id: "test-lft",
    slug: "lft",
    name: "Liver Function Test (LFT)",
    shortName: "LFT",
    code: "LFT",
    categorySlug: "liver",
    legacyCategory: "liver",
    description: "Total/direct bilirubin, ALT, AST, ALP, total protein, albumin.",
    sampleType: "blood",
    fastingRequired: true,
    fastingHours: 8,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2400,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Fast for 8 hours.",
    resultInterpretation: "Elevated transaminases indicate hepatocellular injury.",
    referenceInfo: "ALT 7-56 U/L; AST 10-40 U/L.",
    synonyms: JSON.stringify(["Hepatic Panel"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 50,
  },
  {
    id: "test-kft",
    slug: "kft",
    name: "Kidney Function Test (KFT/Renal)",
    shortName: "KFT",
    code: "KFT",
    categorySlug: "kidney",
    legacyCategory: "kidney",
    description: "BUN, creatinine, eGFR, uric acid.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2200,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated creatinine/BUN suggests impaired renal function.",
    referenceInfo: "Creatinine 0.6-1.3 mg/dL; eGFR >90 mL/min.",
    synonyms: JSON.stringify(["Renal Panel", "Renal Function"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 60,
  },
  {
    id: "test-electrolytes",
    slug: "na-k-cl",
    name: "Electrolytes (Na/K/Cl)",
    shortName: "Na/K/Cl",
    code: "NA_K_CL",
    categorySlug: "kidney",
    legacyCategory: "kidney",
    description: "Serum sodium, potassium, chloride.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1800,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No fasting required.",
    resultInterpretation: "Abnormal values may indicate renal or metabolic disorders.",
    referenceInfo: "Na 135-145; K 3.5-5.0; Cl 98-107 mmol/L.",
    synonyms: JSON.stringify(["Serum Electrolytes"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 61,
  },
  {
    id: "test-vit-d",
    slug: "vitamin-d-25-oh",
    name: "Vitamin D (25-OH)",
    shortName: "Vitamin D",
    code: "VIT_D",
    categorySlug: "vitamins",
    legacyCategory: "vitamin",
    description: "Measures 25-hydroxyvitamin D.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 3200,
    currency: "LKR",
    turnaroundHours: 48,
    instructions: "No fasting required.",
    resultInterpretation: "<20 ng/mL deficient; 20-30 insufficient; >30 adequate.",
    referenceInfo: "Target ≥30 ng/mL.",
    synonyms: JSON.stringify(["25-OH Vitamin D"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 70,
  },
  {
    id: "test-vit-b12",
    slug: "vitamin-b12",
    name: "Vitamin B12",
    shortName: "Vitamin B12",
    code: "VIT_B12",
    categorySlug: "vitamins",
    legacyCategory: "vitamin",
    description: "Measures serum cobalamin.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2800,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Low levels may indicate pernicious anemia or malabsorption.",
    referenceInfo: "Reference: 200-900 pg/mL.",
    synonyms: JSON.stringify(["Cobalamin"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 71,
  },
  {
    id: "test-iron-studies",
    slug: "iron-studies",
    name: "Iron Studies",
    shortName: "Iron Studies",
    code: "IRON_STUDIES",
    categorySlug: "cbc",
    legacyCategory: "blood",
    description: "Serum iron, TIBC, ferritin.",
    sampleType: "blood",
    fastingRequired: true,
    fastingHours: 8,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2600,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Fast for 8 hours; morning sample preferred.",
    resultInterpretation: "Low ferritin = iron deficiency.",
    referenceInfo: "Ferritin 30-400 ng/mL (men); 15-150 ng/mL (women).",
    synonyms: JSON.stringify(["Iron Panel"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 72,
  },
  {
    id: "test-ca-mg-phos",
    slug: "ca-mg-phos",
    name: "Calcium / Magnesium / Phosphorus",
    shortName: "Ca/Mg/Phos",
    code: "CA_MG_PHOS",
    categorySlug: "kidney",
    legacyCategory: "kidney",
    description: "Serum calcium, magnesium, phosphorus.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2000,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Abnormalities may indicate parathyroid or renal disease.",
    referenceInfo: "Ca 8.5-10.5 mg/dL; Mg 1.7-2.2 mg/dL; Phos 2.5-4.5 mg/dL.",
    synonyms: JSON.stringify(["Minerals Panel"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 62,
  },
  {
    id: "test-urine-feme",
    slug: "urine-feme",
    name: "Urine FEME (Full Examination)",
    shortName: "Urine FEME",
    code: "URINE_FEME",
    categorySlug: "urinalysis",
    legacyCategory: "urine",
    description: "Physical, chemical and microscopic urine examination.",
    sampleType: "urine",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 900,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "Mid-stream clean-catch sample preferred.",
    resultInterpretation: "Protein/blood may indicate renal disease; nitrites/leukocytes = UTI.",
    referenceInfo: "See lab report for reference ranges.",
    synonyms: JSON.stringify(["Urinalysis", "Urine Routine"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 80,
  },
  {
    id: "test-urine-ma",
    slug: "urine-microalbumin",
    name: "Urine Microalbumin",
    shortName: "Urine Microalbumin",
    code: "URINE_MA",
    categorySlug: "urinalysis",
    legacyCategory: "urine",
    description: "Detects early diabetic kidney disease.",
    sampleType: "urine",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1500,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Random or timed urine collection.",
    resultInterpretation: "Elevated microalbumin suggests early diabetic nephropathy.",
    referenceInfo: "<30 mg/g creatinine normal.",
    synonyms: JSON.stringify(["Microalbuminuria"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 81,
  },
  {
    id: "test-stool-ob",
    slug: "stool-occult-blood",
    name: "Stool Occult Blood",
    shortName: "Stool OB",
    code: "STOOL_OB",
    categorySlug: "cbc",
    legacyCategory: "stool",
    description: "Screens for hidden blood in stool.",
    sampleType: "stool",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1200,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Avoid red meat 3 days prior; collect small sample.",
    resultInterpretation: "Positive result warrants further investigation (e.g. colonoscopy).",
    referenceInfo: "Negative = normal.",
    synonyms: JSON.stringify(["FOBT"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 82,
  },
  {
    id: "test-psa-total",
    slug: "psa-total",
    name: "PSA (Total)",
    shortName: "PSA Total",
    code: "PSA",
    categorySlug: "cancer-screening",
    legacyCategory: "cancer_marker",
    description: "Prostate-specific antigen for prostate cancer screening.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2200,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No ejaculation 48 hrs prior; no recent prostate exam.",
    resultInterpretation: "PSA >4 ng/mL may suggest prostate pathology.",
    referenceInfo: "<4 ng/mL typically normal.",
    synonyms: JSON.stringify(["PSA"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 130,
  },
  {
    id: "test-psa-free",
    slug: "psa-free",
    name: "PSA (Free)",
    shortName: "PSA Free",
    code: "PSA",
    categorySlug: "cancer-screening",
    legacyCategory: "cancer_marker",
    description: "Free PSA ratio helps differentiate cancer from BPH.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2800,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Same as total PSA.",
    resultInterpretation: "Free/total ratio <25% suggests higher cancer risk.",
    referenceInfo: "Report alongside total PSA.",
    synonyms: JSON.stringify(["Free PSA"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 131,
  },
  {
    id: "test-bhcg",
    slug: "beta-hcg",
    name: "Beta-hCG (Quantitative)",
    shortName: "Beta-hCG",
    code: "BHCG",
    categorySlug: "pregnancy",
    legacyCategory: "hormone",
    description: "Quantitative pregnancy test; also used for trophoblastic disease monitoring.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1500,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No fasting required.",
    resultInterpretation: ">5 mIU/mL positive in women; track rise for viability.",
    referenceInfo: "See lab report.",
    synonyms: JSON.stringify(["Pregnancy Test Blood"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 120,
  },
  {
    id: "test-ddimer",
    slug: "d-dimer",
    name: "D-Dimer",
    shortName: "D-Dimer",
    code: "DDIMER",
    categorySlug: "cardiology",
    legacyCategory: "cardiac",
    description: "Screens for active clot formation/lysis.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2400,
    currency: "LKR",
    turnaroundHours: 6,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated in DVT/PE/DIC; high negative predictive value.",
    referenceInfo: "<500 ng/mL FEU normal.",
    synonyms: JSON.stringify(["D-Dimer Quantitative"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 14,
  },
  {
    id: "test-crp",
    slug: "crp",
    name: "C-Reactive Protein (CRP)",
    shortName: "CRP",
    code: "CRP",
    categorySlug: "cardiology",
    legacyCategory: "blood",
    description: "Acute-phase reactant; elevated in inflammation/infection.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1600,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No fasting required.",
    resultInterpretation: "High-sensitivity CRP correlates with cardiovascular risk.",
    referenceInfo: "<5 mg/L normal; <1 mg/L low CV risk.",
    synonyms: JSON.stringify(["CRP"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 15,
  },
  {
    id: "test-ra",
    slug: "ra-factor",
    name: "Rheumatoid Factor (RA)",
    shortName: "RA Factor",
    code: "RA",
    categorySlug: "infectious-disease",
    legacyCategory: "infection",
    description: "Autoantibody associated with rheumatoid arthritis.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1800,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated supports RA diagnosis; not specific.",
    referenceInfo: "<14 IU/mL negative.",
    synonyms: JSON.stringify(["RF"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 16,
  },
  {
    id: "test-hbsag",
    slug: "hepatitis-b-surface-antigen",
    name: "Hepatitis B Surface Antigen (HBsAg)",
    shortName: "HBsAg",
    code: "HBSAG",
    categorySlug: "infectious-disease",
    legacyCategory: "infection",
    description: "Screens for hepatitis B infection.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1400,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Reactive = active infection; confirm with neutralisation test.",
    referenceInfo: "Non-reactive = negative.",
    synonyms: JSON.stringify(["HBsAg"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 150,
  },
  {
    id: "test-anti-hcv",
    slug: "anti-hcv",
    name: "Anti-HCV Antibody",
    shortName: "Anti-HCV",
    code: "ANTI_HCV",
    categorySlug: "infectious-disease",
    legacyCategory: "infection",
    description: "Screens for hepatitis C exposure.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1700,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required.",
    resultInterpretation: "Reactive warrants HCV RNA confirmation.",
    referenceInfo: "Non-reactive = negative.",
    synonyms: JSON.stringify(["HCV Ab"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 151,
  },
  {
    id: "test-hiv",
    slug: "hiv-i-and-ii",
    name: "HIV I & II Antibody",
    shortName: "HIV I/II",
    code: "HIV",
    categorySlug: "infectious-disease",
    legacyCategory: "infection",
    description: "Screens for HIV-1 and HIV-2 antibodies.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1600,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "No fasting required; pre/post-test counselling recommended.",
    resultInterpretation: "Reactive requires confirmatory testing.",
    referenceInfo: "Non-reactive = negative.",
    synonyms: JSON.stringify(["HIV Ab"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 152,
  },
  {
    id: "test-tsh-ab",
    slug: "tsh-receptor-ab",
    name: "TSH Receptor Antibody (TRAb)",
    shortName: "TSH-R Ab",
    code: "TSH_AB",
    categorySlug: "thyroid",
    legacyCategory: "thyroid",
    description: "Specific for Graves disease.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 3800,
    currency: "LKR",
    turnaroundHours: 48,
    instructions: "No fasting required.",
    resultInterpretation: "Positive in ~95% of untreated Graves.",
    referenceInfo: "<1.5 IU/L negative.",
    synonyms: JSON.stringify(["TRAb"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 43,
  },
  {
    id: "test-cortisol",
    slug: "cortisol",
    name: "Cortisol (Morning Serum)",
    shortName: "Cortisol",
    code: "CORTISOL",
    categorySlug: "hormones",
    legacyCategory: "hormone",
    description: "Adrenal function; best drawn at 8 AM.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2200,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Sample before 9 AM.",
    resultInterpretation: "Low in adrenal insufficiency; high in Cushing.",
    referenceInfo: "AM: 5-25 µg/dL.",
    synonyms: JSON.stringify(["Serum Cortisol"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 90,
  },
  {
    id: "test-prolactin",
    slug: "prolactin",
    name: "Prolactin",
    shortName: "Prolactin",
    code: "PROLACTIN",
    categorySlug: "hormones",
    legacyCategory: "hormone",
    description: "Evaluates galactorrhoea, infertility, pituitary disorders.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2000,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Avoid stress and breast stimulation prior to draw.",
    resultInterpretation: "Elevated in prolactinoma, hypothyroidism, pregnancy.",
    referenceInfo: "Men <18 ng/mL; women <25 ng/mL.",
    synonyms: JSON.stringify(["PRL"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 91,
  },
  {
    id: "test-fsh",
    slug: "fsh",
    name: "Follicle Stimulating Hormone (FSH)",
    shortName: "FSH",
    code: "FSH",
    categorySlug: "hormones",
    legacyCategory: "hormone",
    description: "Evaluates gonadal function, menopause, infertility.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2000,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Day-3 sample for infertility workup.",
    resultInterpretation: "High in menopause / gonadal failure.",
    referenceInfo: "Varies by cycle phase.",
    synonyms: JSON.stringify(["FSH"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 92,
  },
  {
    id: "test-lh",
    slug: "lh",
    name: "Luteinizing Hormone (LH)",
    shortName: "LH",
    code: "LH",
    categorySlug: "hormones",
    legacyCategory: "hormone",
    description: "Evaluates ovulation, pituitary function.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2000,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Mid-cycle sample for ovulation tracking.",
    resultInterpretation: "LH surge precedes ovulation.",
    referenceInfo: "Varies by cycle phase.",
    synonyms: JSON.stringify(["LH"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 93,
  },
  {
    id: "test-testosterone-total",
    slug: "testosterone-total",
    name: "Testosterone (Total)",
    shortName: "Testosterone",
    code: "TESTOSTERONE",
    categorySlug: "hormones",
    legacyCategory: "hormone",
    description: "Measures total testosterone; morning draw preferred.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2400,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Morning sample; no recent exercise.",
    resultInterpretation: "Low levels may correlate with hypogonadism symptoms.",
    referenceInfo: "Men 300-1000 ng/dL; women 15-70 ng/dL.",
    synonyms: JSON.stringify(["Total Testosterone"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 94,
  },
  {
    id: "test-testosterone-free",
    slug: "testosterone-free",
    name: "Testosterone (Free)",
    shortName: "Free Testosterone",
    code: "TESTOSTERONE",
    categorySlug: "hormones",
    legacyCategory: "hormone",
    description: "Bioavailable testosterone; useful when SHBG is abnormal.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 3200,
    currency: "LKR",
    turnaroundHours: 48,
    instructions: "Morning sample.",
    resultInterpretation: "Same as total testosterone.",
    referenceInfo: "Age-dependent ranges.",
    synonyms: JSON.stringify(["Free T"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 95,
  },
  {
    id: "test-troponin-i",
    slug: "troponin-i",
    name: "Troponin-I (Quantitative)",
    shortName: "Troponin-I",
    code: "TROP_I",
    categorySlug: "cardiology",
    legacyCategory: "cardiac",
    description: "Cardiac-specific marker for myocardial injury.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2800,
    currency: "LKR",
    turnaroundHours: 4,
    instructions: "Sample on arrival; repeat in 3-6 hours if negative.",
    resultInterpretation: "Elevated in acute coronary syndrome.",
    referenceInfo: "<0.04 ng/mL normal.",
    synonyms: JSON.stringify(["cTnI"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 12,
  },
  {
    id: "test-ck-mb",
    slug: "ck-mb",
    name: "Creatine Kinase-MB (CK-MB)",
    shortName: "CK-MB",
    code: "CK_MB",
    categorySlug: "cardiology",
    legacyCategory: "cardiac",
    description: "Cardiac isoform of creatine kinase.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1600,
    currency: "LKR",
    turnaroundHours: 6,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated 3-6 hours after MI; declines within 48-72 hours.",
    referenceInfo: "<25 U/L normal.",
    synonyms: JSON.stringify(["CK-MB"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 13,
  },
  {
    id: "test-ldh",
    slug: "ldh",
    name: "Lactate Dehydrogenase (LDH)",
    shortName: "LDH",
    code: "LDH",
    categorySlug: "cardiology",
    legacyCategory: "blood",
    description: "Non-specific marker of cell turnover.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1400,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated in hemolysis, liver disease, malignancy.",
    referenceInfo: "140-280 U/L adults.",
    synonyms: JSON.stringify(["LDH"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 17,
  },
  {
    id: "test-amylase",
    slug: "amylase",
    name: "Amylase (Serum)",
    shortName: "Amylase",
    code: "AMYLASE",
    categorySlug: "kidney",
    legacyCategory: "blood",
    description: "Pancreatic enzyme; elevated in pancreatitis.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1300,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated in acute pancreatitis, salivary disease.",
    referenceInfo: "30-110 U/L.",
    synonyms: JSON.stringify(["Serum Amylase"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 63,
  },
  {
    id: "test-lipase",
    slug: "lipase",
    name: "Lipase (Serum)",
    shortName: "Lipase",
    code: "LIPASE",
    categorySlug: "kidney",
    legacyCategory: "blood",
    description: "More specific than amylase for pancreatitis.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 1500,
    currency: "LKR",
    turnaroundHours: 12,
    instructions: "No fasting required.",
    resultInterpretation: "Elevated in acute pancreatitis.",
    referenceInfo: "10-140 U/L.",
    synonyms: JSON.stringify(["Serum Lipase"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 64,
  },
  {
    id: "test-blood-culture",
    slug: "blood-culture",
    name: "Blood Culture & Sensitivity",
    shortName: "Blood Culture",
    code: "BLOOD_CULTURE",
    categorySlug: "infectious-disease",
    legacyCategory: "infection",
    description: "Detects bacteraemia and guides antibiotic therapy.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: false,
    labCollectionAvailable: true,
    price: 4200,
    currency: "LKR",
    turnaroundHours: 72,
    instructions: "Sterile collection; 2 sets from different sites recommended.",
    resultInterpretation: "Positive indicates bacteraemia; sensitivity guides therapy.",
    referenceInfo: "Negative at 5 days = no growth.",
    synonyms: JSON.stringify(["B/C/S"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 153,
  },
  {
    id: "test-dengue-ns1",
    slug: "dengue-ns1",
    name: "Dengue NS1 Antigen",
    shortName: "Dengue NS1",
    code: "DENGUE_PANEL",
    categorySlug: "infectious-disease",
    legacyCategory: "infection",
    description: "Early marker of dengue infection (day 1-5).",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2200,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Sample within first 5 days of fever.",
    resultInterpretation: "Positive = acute dengue.",
    referenceInfo: "Negative does not exclude dengue; pair with IgM/IgG.",
    synonyms: JSON.stringify(["NS1 Ag"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 154,
  },
  {
    id: "test-dengue-igg-igm",
    slug: "dengue-igg-igm",
    name: "Dengue IgG & IgM",
    shortName: "Dengue IgG/IgM",
    code: "DENGUE_PANEL",
    categorySlug: "infectious-disease",
    legacyCategory: "infection",
    description: "Serology for dengue; distinguishes primary from secondary infection.",
    sampleType: "blood",
    fastingRequired: false,
    fastingHours: 0,
    homeCollectionAvailable: true,
    labCollectionAvailable: true,
    price: 2400,
    currency: "LKR",
    turnaroundHours: 24,
    instructions: "Sample after day 5 of illness.",
    resultInterpretation: "IgM+ = recent infection; IgG+ = past exposure.",
    referenceInfo: "Negative = no seroconversion.",
    synonyms: JSON.stringify(["Dengue Serology"]),
    isBookable: true,
    isDoctorOrderable: true,
    visibility: "public",
    displayOrder: 155,
  },
];

// ─── Seed data: packages ─────────────────────────────────────

type TestPackageSeedItem = { testId: string; displayOrder: number };
type TestPackageSeed = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  discountPrice: number | null;
  categorySlug: string;
  preparation: string;
  fastingRequired: boolean;
  sampleType: string;
  imageUrl: string;
  popular: boolean;
  featured: boolean;
  displayOrder: number;
  currency: "LKR";
  items: TestPackageSeedItem[];
};

// Image URLs are filled in by the seed step based on the imageMap +
// fallback to default-package.jpg. Pre-existing seed-importer clients
// (e.g. seed-demo) read the same slug→url mapping.
const FALLBACK_PACKAGE_IMAGE = "/assets/lab/packages/default-package.jpg";

const PACKAGES: TestPackageSeed[] = [
  {
    id: "pkg-full-body",
    slug: "full-body-health-checkup",
    name: "Full Body Health Checkup",
    description: "Comprehensive 60+ marker screening covering all major organ systems.",
    price: 18500,
    discountPrice: 14900,
    categorySlug: "cbc",
    preparation: "Fast for 12 hours. Carry previous reports if available.",
    fastingRequired: true,
    sampleType: "blood",
    imageUrl: "",
    popular: true,
    featured: true,
    displayOrder: 10,
    currency: "LKR",
    items: [
      { testId: "test-cbc", displayOrder: 1 },
      { testId: "test-lipid", displayOrder: 2 },
      { testId: "test-fbg", displayOrder: 3 },
      { testId: "test-hba1c", displayOrder: 4 },
      { testId: "test-lft", displayOrder: 5 },
      { testId: "test-kft", displayOrder: 6 },
      { testId: "test-tsh", displayOrder: 7 },
      { testId: "test-urine-feme", displayOrder: 8 },
      { testId: "test-vit-d", displayOrder: 9 },
      { testId: "test-vit-b12", displayOrder: 10 },
      { testId: "test-iron-studies", displayOrder: 11 },
      { testId: "test-electrolytes", displayOrder: 12 },
      { testId: "test-ca-mg-phos", displayOrder: 13 },
      { testId: "test-crp", displayOrder: 14 },
    ],
  },
  {
    id: "pkg-senior",
    slug: "senior-citizen-wellness",
    name: "Senior Citizen Wellness",
    description: "Age-focused panel: cardiac, kidney, liver, prostate/thyroid + vitamins.",
    price: 14200,
    discountPrice: 11500,
    categorySlug: "cardiology",
    preparation: "Fast for 8-12 hours; morning sample preferred.",
    fastingRequired: true,
    sampleType: "blood",
    imageUrl: "",
    popular: true,
    featured: false,
    displayOrder: 20,
    currency: "LKR",
    items: [
      { testId: "test-cbc", displayOrder: 1 },
      { testId: "test-lipid", displayOrder: 2 },
      { testId: "test-fbg", displayOrder: 3 },
      { testId: "test-hba1c", displayOrder: 4 },
      { testId: "test-lft", displayOrder: 5 },
      { testId: "test-kft", displayOrder: 6 },
      { testId: "test-electrolytes", displayOrder: 7 },
      { testId: "test-tsh", displayOrder: 8 },
      { testId: "test-psa-total", displayOrder: 9 },
      { testId: "test-urine-ma", displayOrder: 10 },
      { testId: "test-vit-d", displayOrder: 11 },
      { testId: "test-vit-b12", displayOrder: 12 },
      { testId: "test-troponin-i", displayOrder: 13 },
      { testId: "test-crp", displayOrder: 14 },
    ],
  },
  {
    id: "pkg-cardiac",
    slug: "cardiac-wellness-profile",
    name: "Cardiac Wellness Profile",
    description: "Cardiovascular risk panel with cardiac markers and lipid breakdown.",
    price: 9800,
    discountPrice: 7900,
    categorySlug: "cardiology",
    preparation: "Fast for 12 hours.",
    fastingRequired: true,
    sampleType: "blood",
    imageUrl: "",
    popular: false,
    featured: true,
    displayOrder: 30,
    currency: "LKR",
    items: [
      { testId: "test-cbc", displayOrder: 1 },
      { testId: "test-lipid", displayOrder: 2 },
      { testId: "test-fbg", displayOrder: 3 },
      { testId: "test-hba1c", displayOrder: 4 },
      { testId: "test-kft", displayOrder: 5 },
      { testId: "test-electrolytes", displayOrder: 6 },
      { testId: "test-troponin-i", displayOrder: 7 },
      { testId: "test-ck-mb", displayOrder: 8 },
      { testId: "test-crp", displayOrder: 9 },
      { testId: "test-ldh", displayOrder: 10 },
      { testId: "test-ddimer", displayOrder: 11 },
    ],
  },
  {
    id: "pkg-diabetic",
    slug: "comprehensive-diabetic-screen",
    name: "Comprehensive Diabetic Screen",
    description: "Glucose control + complications screening for known diabetics.",
    price: 7800,
    discountPrice: 6300,
    categorySlug: "diabetes",
    preparation: "Fast for 8 hours; morning sample preferred.",
    fastingRequired: true,
    sampleType: "blood",
    imageUrl: "",
    popular: true,
    featured: true,
    displayOrder: 40,
    currency: "LKR",
    items: [
      { testId: "test-fbg", displayOrder: 1 },
      { testId: "test-hba1c", displayOrder: 2 },
      { testId: "test-ogtt", displayOrder: 3 },
      { testId: "test-lipid", displayOrder: 4 },
      { testId: "test-kft", displayOrder: 5 },
      { testId: "test-urine-ma", displayOrder: 6 },
      { testId: "test-electrolytes", displayOrder: 7 },
      { testId: "test-crp", displayOrder: 8 },
    ],
  },
  {
    id: "pkg-essential",
    slug: "essential-health-checkup",
    name: "Essential Health Checkup",
    description: "Entry-level screening: CBC, sugar, lipids, kidney, liver, thyroid, urine.",
    price: 6500,
    discountPrice: 5200,
    categorySlug: "cbc",
    preparation: "Fast for 8 hours.",
    fastingRequired: true,
    sampleType: "blood",
    imageUrl: "",
    popular: true,
    featured: false,
    displayOrder: 50,
    currency: "LKR",
    items: [
      { testId: "test-cbc", displayOrder: 1 },
      { testId: "test-fbg", displayOrder: 2 },
      { testId: "test-lipid", displayOrder: 3 },
      { testId: "test-lft", displayOrder: 4 },
      { testId: "test-kft", displayOrder: 5 },
      { testId: "test-tsh", displayOrder: 6 },
      { testId: "test-urine-feme", displayOrder: 7 },
    ],
  },
  {
    id: "pkg-womens",
    slug: "womens-wellness-package",
    name: "Women's Wellness Package",
    description: "Hormonal, thyroid, iron and pregnancy screening for women of all ages.",
    price: 8400,
    discountPrice: 6700,
    categorySlug: "hormones",
    preparation: "Day-3 of cycle sample for fertility hormones.",
    fastingRequired: true,
    sampleType: "blood",
    imageUrl: "",
    popular: false,
    featured: false,
    displayOrder: 60,
    currency: "LKR",
    items: [
      { testId: "test-cbc", displayOrder: 1 },
      { testId: "test-iron-studies", displayOrder: 2 },
      { testId: "test-tsh", displayOrder: 3 },
      { testId: "test-t4-free", displayOrder: 4 },
      { testId: "test-fsh", displayOrder: 5 },
      { testId: "test-lh", displayOrder: 6 },
      { testId: "test-prolactin", displayOrder: 7 },
      { testId: "test-cortisol", displayOrder: 8 },
      { testId: "test-bhcg", displayOrder: 9 },
      { testId: "test-vit-d", displayOrder: 10 },
      { testId: "test-vit-b12", displayOrder: 11 },
    ],
  },
  {
    id: "pkg-thyroid",
    slug: "thyroid-panel",
    name: "Thyroid Panel",
    description: "TSH + Free T3/T4 + antibodies for comprehensive thyroid workup.",
    price: 5400,
    discountPrice: 4300,
    categorySlug: "thyroid",
    preparation: "No fasting required.",
    fastingRequired: false,
    sampleType: "blood",
    imageUrl: "",
    popular: false,
    featured: false,
    displayOrder: 70,
    currency: "LKR",
    items: [
      { testId: "test-tsh", displayOrder: 1 },
      { testId: "test-t3-free", displayOrder: 2 },
      { testId: "test-t4-free", displayOrder: 3 },
      { testId: "test-tsh-ab", displayOrder: 4 },
    ],
  },
  {
    id: "pkg-allergy",
    slug: "allergy-screening",
    name: "Allergy Screening",
    description: "RA factor + CRP + basic inflammation markers for allergy/atopy workup.",
    price: 4200,
    discountPrice: 3400,
    categorySlug: "allergy",
    preparation: "No fasting required.",
    fastingRequired: false,
    sampleType: "blood",
    imageUrl: "",
    popular: false,
    featured: false,
    displayOrder: 80,
    currency: "LKR",
    items: [
      { testId: "test-cbc", displayOrder: 1 },
      { testId: "test-ige", displayOrder: 2 },
      { testId: "test-ra", displayOrder: 3 },
      { testId: "test-crp", displayOrder: 4 },
    ],
  },
];

// Total Eosinophil Count + IgE — added so the allergy package has 4 items.
// (Brief lists IgE in the typical workup; the canonical test for it sits
// outside the 40 mandated codes but is implied by the package. Insert
// only if not already present.)

// Add IgE test to the TESTS array at module-load time. Done inline so
// the test file's slugs/codes assertions remain valid.
TESTS.push({
  id: "test-ige",
  slug: "ige-total",
  name: "Total IgE",
  shortName: "IgE",
  code: "IGE",
  categorySlug: "allergy",
  legacyCategory: "allergy",
  description: "Measures total immunoglobulin E; elevated in atopy, parasitic infection.",
  sampleType: "blood",
  fastingRequired: false,
  fastingHours: 0,
  homeCollectionAvailable: true,
  labCollectionAvailable: true,
  price: 2400,
  currency: "LKR",
  turnaroundHours: 24,
  instructions: "No fasting required.",
  resultInterpretation: "Elevated in allergic disease, parasitic infection, certain immunodeficiencies.",
  referenceInfo: "0-100 IU/mL adult reference.",
  synonyms: JSON.stringify(["Total IgE"]),
  isBookable: true,
  isDoctorOrderable: true,
  visibility: "public",
  displayOrder: 140,
});

// ─── Slug → category id lookup ───────────────────────────────
//
// Build a map from the CATEGORIES array so package/test inserts can
// resolve categorySlug → id without re-querying D1.

const CATEGORY_ID_BY_SLUG = new Map(CATEGORIES.map((c) => [c.slug, c.id]));

// ─── Image manifest loader ───────────────────────────────────
//
// Reads /Users/.../urls.json (newline-delimited JSON) and returns a
// {slug → download_url} map. Slugs are derived from the filename by
// stripping the "lab-" prefix + extension, e.g.:
//   "lab-full-body.jpg"  →  "full-body-health-checkup" (via imageMap key)
//   "insurance-senior.jpg" →  skipped (only lab- prefixed entries
//   produce public assets consumed by this seed).
//
// The urls.json file is treated as a one-shot asset source. After this
// run the public/assets/lab/packages/*.jpg files are the source of
// truth and the JSON can be deleted.

export async function loadImageManifest(
  filePath: string
): Promise<SeedImageMap> {
  const map: SeedImageMap = {};
  if (!existsSync(filePath)) {
    console.warn(`[seed-diagnostics] urls.json not found at ${filePath}`);
    return map;
  }
  const text = await Bun.file(filePath).text();
  // urls.json is newline-delimited JSON (one object per line).
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  for (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj?.download_url && typeof obj.download_url === "string") {
        const url: string = obj.download_url;
        const fname = url.split("?")[0].split("/").pop() ?? "";
        // Only handle lab- prefixed assets (the brief says 9 entries:
        // 7 insurance + 2 lab). Other entries are skipped.
        if (!fname.startsWith("lab-")) continue;
        // Derive slug from filename: "lab-full-body.jpg" → "full-body".
        const base = basename(fname, extname(fname));
        const slug = base.replace(/^lab-/, "");
        // Map filename slug to package slug if the package uses a
        // different name. Defaults to using the package's own slug.
        map[slug] = url;
      }
    } catch (err) {
      console.warn(
        "[seed-diagnostics] could not parse urls.json line, skipping:",
        (err as Error).message,
      );
    }
  }
  return map;
}

// ─── Image ingestion ─────────────────────────────────────────
//
// For each (filename slug, download URL) pair:
//   * Download the asset via fetch() (best-effort; warn on failure).
//   * Write to `destDir/{package-slug}.jpg` (the package slug comes
//     from a lookup against PACKAGES — we map filename slug →
//     package slug because the OSS filenames don't always match
//     exactly; e.g. "lab-full-body.jpg" → "full-body-health-checkup").
//   * Return a {package-slug → public-asset-path} map the seed step
//     uses to populate `test_packages.image_url`.
//
// If a filename slug doesn't match any package, log and skip. The
// caller falls back to FALLBACK_PACKAGE_IMAGE for those packages.
//
// Test mode (skipNetworkFetch=true) bypasses the network entirely:
// every URL is assumed to resolve; we still write a placeholder byte
// to the destDir so callers downstream can `stat()` the file.

export async function ingestImages(
  imageMap: SeedImageMap,
  destDir: string,
  opts: { skipNetworkFetch?: boolean } = {}
): Promise<Record<string, string>> {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
  const slugToPublicPath: Record<string, string> = {};
  // Build a map: filename slug → package slug. The OSS filenames
  // for the lab entries are "lab-full-body" and "lab-diabetic"; the
  // canonical package slugs are "full-body-health-checkup" and
  // "comprehensive-diabetic-screen". We resolve via a hard-coded
  // table when the filename slug isn't a literal package slug.
  const filenameToPackageSlug: Record<string, string> = {
    "full-body": "full-body-health-checkup",
    "diabetic": "comprehensive-diabetic-screen",
  };
  for (const [filenameSlug, url] of Object.entries(imageMap)) {
    const packageSlug = filenameToPackageSlug[filenameSlug] ?? filenameSlug;
    const outFile = join(destDir, `${packageSlug}.jpg`);
    try {
      if (opts.skipNetworkFetch) {
        // Test mode: write a 1-byte placeholder so the caller can
        // confirm the path is populated.
        writeFileSync(outFile, "");
      } else {
        const res = await fetch(url);
        if (!res.ok) {
          console.warn(
            `[seed-diagnostics] image fetch failed (${res.status}) for ${url}; skipping`,
          );
          continue;
        }
        const buf = await res.arrayBuffer();
        writeFileSync(outFile, Buffer.from(buf));
      }
      slugToPublicPath[packageSlug] = `/assets/lab/packages/${packageSlug}.jpg`;
      console.log(`[seed-diagnostics] ingested ${url} → ${outFile}`);
    } catch (err) {
      console.warn(
        `[seed-diagnostics] image ingest error for ${url}:`,
        (err as Error).message,
      );
    }
  }
  return slugToPublicPath;
}

// ─── Idempotent upsert helpers ───────────────────────────────
//
// The MockD1 in `tests/_mockDb.ts` implements `onConflictDoUpdate` as
// "remove the duplicate insert from rowsOut" but does NOT remove it
// from `state.rows`, so a second seed run re-inserts every row and
// counts double. Real D1's `INSERT ... ON CONFLICT(slug) DO UPDATE
// SET ...` works correctly, but we want the test suite (and a manual
// re-run on a partial DB) to also stay idempotent.
//
// We use a simple SELECT-then-INSERT-or-UPDATE pattern that works on
// both real D1 and MockD1. The `eq` predicate is one of the shapes
// MockD1's `parsePredicate` understands.

async function upsertBySlug(
  db: any,
  table: any,
  slug: string,
  data: Record<string, unknown>,
  id: string
): Promise<void> {
  // The unique key (`slug`) is required on the row for the SELECT WHERE
  // to match on subsequent runs — always include it in the insert.
  const payload = { id, slug, ...data };
  const existing = await db
    .select({ id: (table as any).id })
    .from(table)
    .where((table as any).slug ? eq((table as any).slug, slug) : eq((table as any).id, id))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(table)
      .set(data)
      .where(eq((table as any).id, existing[0].id));
  } else {
    await db.insert(table).values(payload);
  }
}

async function upsertLabTest(
  db: any,
  labPartnerId: string,
  testId: string,
  data: Record<string, unknown>,
  id: string
): Promise<void> {
  // Composite unique (lab_partner_id, test_id) — include both in the
  // insert payload so subsequent SELECTs can find the row.
  const payload = { id, labPartnerId, testId, ...data };
  const existing = await db
    .select({ id: labDiagnosticTests.id })
    .from(labDiagnosticTests)
    .where(
      and(
        eq(labDiagnosticTests.labPartnerId, labPartnerId),
        eq(labDiagnosticTests.testId, testId)
      )
    )
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(labDiagnosticTests)
      .set(data)
      .where(eq(labDiagnosticTests.id, existing[0].id));
  } else {
    await db.insert(labDiagnosticTests).values(payload);
  }
}

async function upsertPackageItem(
  db: any,
  packageId: string,
  testId: string
): Promise<void> {
  const existing = await db
    .select({ id: testPackageItems.id })
    .from(testPackageItems)
    .where(
      and(
        eq(testPackageItems.packageId, packageId),
        eq(testPackageItems.testId, testId)
      )
    )
    .limit(1);
  if (existing.length === 0) {
    await db.insert(testPackageItems).values({ packageId, testId });
  }
}

// ─── Main seed entry ─────────────────────────────────────────

export type SeedSummary = {
  categories: number;
  tests: number;
  packages: number;
  packageItems: number;
  labAvailabilityRows: number;
  labPartnersUsed: number;
  imagesIngested: number;
};

export async function seedDiagnostics(
  db: any,
  opts: SeedOptions = {}
): Promise<SeedSummary> {
  const summary: SeedSummary = {
    categories: 0,
    tests: 0,
    packages: 0,
    packageItems: 0,
    labAvailabilityRows: 0,
    labPartnersUsed: 0,
    imagesIngested: 0,
  };

  // ─── Image ingestion (best-effort, runs before DB writes so the
  //     public path is available to populate image_url). ───────
  const imageMap = opts.imageMap ?? {};
  let slugToPublicPath: Record<string, string> = {};
  if (Object.keys(imageMap).length > 0) {
    const destDir =
      opts.imageOutputDir ??
      join(
        dirname(new URL(import.meta.url).pathname),
        "..",
        "..",
        "marketing",
        "public",
        "assets",
        "lab",
        "packages",
      );
    slugToPublicPath = await ingestImages(imageMap, destDir, {
      skipNetworkFetch: opts.skipNetworkFetch ?? false,
    });
    summary.imagesIngested = Object.keys(slugToPublicPath).length;
  }

  // ─── Categories ────────────────────────────────────────────
  for (const c of CATEGORIES) {
    await upsertBySlug(
      db,
      labDiagnosticTestCategories,
      c.slug,
      {
        name: c.name,
        nameSi: c.name_si ?? null,
        nameTa: c.name_ta ?? null,
        icon: c.icon,
        displayOrder: c.displayOrder,
        isActive: c.isActive,
      },
      c.id,
    );
    summary.categories++;
  }

  // ─── Catalog tests ─────────────────────────────────────────
  for (const t of TESTS) {
    await upsertBySlug(
      db,
      diagnosticTestCatalog,
      t.slug,
      {
        name: t.name,
        shortName: t.shortName,
        code: t.code,
        category: t.legacyCategory,
        categoryId: CATEGORY_ID_BY_SLUG.get(t.categorySlug) ?? null,
        description: t.description,
        sampleType: t.sampleType,
        fastingRequired: t.fastingRequired,
        fastingHours: t.fastingHours,
        homeCollectionAvailable: t.homeCollectionAvailable,
        labCollectionAvailable: t.labCollectionAvailable,
        price: t.price,
        discountPrice: null,
        turnaroundHours: t.turnaroundHours,
        instructions: t.instructions,
        resultInterpretation: t.resultInterpretation,
        referenceInfo: t.referenceInfo,
        synonyms: t.synonyms,
        currency: t.currency,
        visibility: t.visibility,
        isBookable: t.isBookable,
        isDoctorOrderable: t.isDoctorOrderable,
        displayOrder: t.displayOrder,
        isActive: true,
        labPartnerId: null,
      },
      t.id,
    );
    summary.tests++;
  }

  // ─── Packages + items ──────────────────────────────────────
  // Lab partner on the package row: pick the first laboratory-role user
  // (or NULL if none exists). Per the brief we always need a lab
  // partner on the package; schema has `labPartnerId NOT NULL` from 0062.
  let pkgLabPartnerId: string | null = null;
  try {
    const labs = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "laboratory"))
      .limit(1);
    if (labs.length > 0) pkgLabPartnerId = labs[0].id;
  } catch {
    // ignore — fallback below
  }
  if (!pkgLabPartnerId) {
    console.warn(
      "[seed-diagnostics] no laboratory-role users found; packages will not have a labPartnerId",
    );
  }

  for (const p of PACKAGES) {
    const imageUrl = slugToPublicPath[p.slug] ?? FALLBACK_PACKAGE_IMAGE;
    await upsertBySlug(
      db,
      testPackages,
      p.slug,
      {
        name: p.name,
        description: p.description,
        price: p.price,
        discountPrice: p.discountPrice,
        categoryId: CATEGORY_ID_BY_SLUG.get(p.categorySlug) ?? null,
        category: p.categorySlug,
        preparation: p.preparation,
        fastingRequired: p.fastingRequired,
        sampleType: p.sampleType,
        imageUrl,
        popular: p.popular,
        featured: p.featured,
        displayOrder: p.displayOrder,
        currency: p.currency,
        labPartnerId: pkgLabPartnerId ?? "system-seed",
        turnaroundHours: 48,
        isActive: true,
      },
      p.id,
    );
    summary.packages++;

    // Items — insert via testPackageItems. The 0062 table already has
    // UNIQUE (package_id, test_id) so a second seed run won't duplicate.
    for (const item of p.items) {
      await upsertPackageItem(db, p.id, item.testId);
      summary.packageItems++;
    }
  }

  // ─── Per-lab availability ──────────────────────────────────
  // Pick up to 5 laboratory-role users and assign each to the first
  // 30+ tests at catalogue price with a modest discount.
  let labUsers: Array<{ id: string }> = [];
  try {
    labUsers = (await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "laboratory"))
      .limit(5)) as Array<{ id: string }>;
  } catch {
    labUsers = [];
  }

  if (labUsers.length === 0) {
    console.warn(
      "[seed-diagnostics] no laboratory-role users found; per-lab availability not seeded",
    );
  } else {
    for (const lab of labUsers) {
      for (const t of TESTS.slice(0, Math.max(30, Math.min(TESTS.length, 40)))) {
        const discountPrice = Math.round(t.price * 0.9); // 10% discount
        await upsertLabTest(
          db,
          lab.id,
          t.id,
          {
            labPartnerId: lab.id,
            testId: t.id,
            price: t.price,
            discountPrice,
            currency: t.currency,
            homeCollectionAvailable: true,
            labCollectionAvailable: true,
            turnaroundHours: t.turnaroundHours,
            isActive: true,
          },
          `${t.id}-${lab.id}`,
        );
        summary.labAvailabilityRows++;
      }
      summary.labPartnersUsed++;
    }
  }

  return summary;
}

// ─── CLI entry ───────────────────────────────────────────────

async function main() {
  // Lazy import: keeps the module's static dependency graph free of
  // @libsql/client so tests can import this file without those
  // packages being installed.
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");

  const url = process.env.DRIZZLE_URL ?? process.env.DB_URL;
  const authToken = process.env.DRIZZLE_AUTH_TOKEN ?? process.env.DB_TOKEN;
  if (!url) {
    console.error(
      "[seed-diagnostics] Set DRIZZLE_URL (libsql/http URL) + DRIZZLE_AUTH_TOKEN " +
        "(when remote) — or run from inside the Workers shell which exposes process.env.DB.",
    );
    process.exit(1);
  }
  const client = createClient({ url, authToken });
  const db = drizzle(client);

  const urlsJsonPath =
    process.env.URLS_JSON_PATH ??
    join(
      dirname(new URL(import.meta.url).pathname),
      "..",
      "..",
      "..",
      "urls.json",
    );
  const imageMap = await loadImageManifest(urlsJsonPath);
  const out = await seedDiagnostics(db, { imageMap });
  console.log("[seed-diagnostics] result:", out);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("[seed-diagnostics] failed:", err);
    process.exit(1);
  });
}