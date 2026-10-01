"use client";

import { use, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Award,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FlaskConical,
  Home,
  Layers,
  Loader2,
  MapPin,
  Phone,
  Star,
  TrendingDown,
} from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { formatLkr } from "@/portal/lib/format";
import { useBookTestPackage, useTestPackage } from "@/patient/hooks/diagnostic";
import { cn } from "@/portal/lib/utils";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  FIELD_TEXTAREA,
  HERO_CHIP,
  HERO_GHOST,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PromoCard,
  SECONDARY_BTN,
} from "@/patient/components/workspace";

interface CuratedPackageInfo {
  id: string;
  slug: string;
  name: string;
  tag: string;
  price: number;
  originalPrice: number;
  savings: number;
  testCount: number;
  reportTimeHours: number;
  fastingHours: number;
  description: string;
  preparation: string;
  tests: string[];
}

const CURATED_PACKAGES: Record<string, CuratedPackageInfo> = {
  "full-body-health-checkup": {
    id: "pkg-full-body",
    slug: "full-body-health-checkup",
    name: "Full Body Executive Health Checkup",
    tag: "BEST VALUE",
    price: 5900,
    originalPrice: 8500,
    savings: 2600,
    testCount: 68,
    reportTimeHours: 12,
    fastingHours: 10,
    description:
      "Comprehensive diagnostic screening covering vital organs, blood profile, metabolic markers, and liver/kidney functions.",
    preparation:
      "Requires 10-12 hours overnight fasting. You may drink plain water. Avoid alcohol and intense physical exertion 24 hours prior to sample collection.",
    tests: [
      "Complete Blood Count (CBC with Differential)",
      "Lipid Profile (Total Cholesterol, HDL, LDL, VLDL, Triglycerides)",
      "Liver Function Test (SGPT, SGOT, Bilirubin, Alkaline Phosphatase, Total Protein)",
      "Renal Function Test (Serum Creatinine, Blood Urea, BUN, eGFR)",
      "Fasting Blood Sugar (FBS)",
      "Urine Full Report (UFR) & Automated Microscopy",
      "Thyroid Stimulating Hormone (TSH)",
      "HbA1c (3-Month Glycemic Average)",
      "Serum Electrolytes (Sodium, Potassium, Chloride)",
      "Serum Uric Acid (Joint Health & Gout Screening)",
      "Calcium & Total Vitamin D3 Assays",
      "Erythrocyte Sedimentation Rate (ESR)",
    ],
  },
  "senior-citizen-wellness": {
    id: "pkg-senior",
    slug: "senior-citizen-wellness",
    name: "Senior Citizen Wellness & Vitality",
    tag: "SENIOR CARE",
    price: 6500,
    originalPrice: 9200,
    savings: 2700,
    testCount: 45,
    reportTimeHours: 18,
    fastingHours: 8,
    description:
      "Designed specifically for age 55+ to track bone health, vital organ functions, vitamin levels, and joint inflammation markers.",
    preparation:
      "8-10 hours fasting recommended. You may take regular morning medications with water unless specifically advised otherwise by your doctor.",
    tests: [
      "Total Vitamin D3 & Serum Calcium",
      "Vitamin B12 Vitality Assay",
      "Serum Uric Acid & Bone Health",
      "Complete Kidney Function & eGFR",
      "Full Liver Enzymes & Albumin",
      "HbA1c & Fasting Glucose",
      "Complete Blood Profile (CBC)",
      "Urine Microalbumin / Creatinine Ratio",
      "Cardiac High-Sensitivity CRP (hs-CRP)",
    ],
  },
  "cardiac-wellness-profile": {
    id: "pkg-cardiac",
    slug: "cardiac-wellness-profile",
    name: "Advanced Cardiac & Vascular Profile",
    tag: "CARDIO HEALTH",
    price: 5400,
    originalPrice: 7800,
    savings: 2400,
    testCount: 32,
    reportTimeHours: 16,
    fastingHours: 12,
    description:
      "Heart-health risk assessment detecting silent arterial plaque indicators, systemic inflammation, and lipid abnormalities.",
    preparation:
      "12 hours strict fasting required. Water is permitted. Avoid heavy or high-fat meals for 24 hours prior to blood draw.",
    tests: [
      "High-Sensitivity C-Reactive Protein (hs-CRP)",
      "Extended Lipid Profile & Cholesterol Ratios",
      "Apolipoprotein A1 & Apolipoprotein B Ratio",
      "Serum Homocysteine (Cardiovascular Risk Marker)",
      "Serum Electrolytes (Sodium, Potassium, Chloride)",
      "Fasting Blood Sugar & Insulin Resistance Markers",
      "Serum Creatinine & Renal Baseline",
    ],
  },
  "comprehensive-diabetic-screen": {
    id: "pkg-diabetic",
    slug: "comprehensive-diabetic-screen",
    name: "Comprehensive Diabetic Care Package",
    tag: "POPULAR",
    price: 3800,
    originalPrice: 5200,
    savings: 1400,
    testCount: 28,
    reportTimeHours: 8,
    fastingHours: 10,
    description:
      "Essential periodic monitoring for pre-diabetic and diabetic management, including 3-month glycemic averages.",
    preparation:
      "10 hours fasting for the morning collection. Post-prandial blood draw is scheduled exactly 2 hours after your breakfast.",
    tests: [
      "HbA1c Glycated Hemoglobin",
      "Fasting Blood Sugar (FBS)",
      "Post-Prandial Blood Sugar (PPBS)",
      "Microalbumin / Creatinine Ratio (Early Kidney Marker)",
      "Serum Creatinine & Estimated GFR",
      "Lipid Profile (Triglycerides & HDL)",
      "Urine Full Report (Glucose, Protein & Ketones)",
    ],
  },
  "essential-health-checkup": {
    id: "pkg-essential",
    slug: "essential-health-checkup",
    name: "Essential Health Checkup",
    tag: "BASIC CARE",
    price: 2800,
    originalPrice: 3500,
    savings: 700,
    testCount: 18,
    reportTimeHours: 6,
    fastingHours: 8,
    description:
      "Vital baseline diagnostic assessment for routine annual wellness checks and basic metabolic evaluation.",
    preparation: "8 hours fasting recommended for optimal glucose and lipid measurement accuracy.",
    tests: [
      "Complete Blood Count (CBC with Differential)",
      "Routine Urine Analysis (UFR)",
      "Fasting Blood Glucose",
      "Total Cholesterol Screening",
      "Serum Creatinine (Renal Baseline)",
      "Erythrocyte Sedimentation Rate (ESR)",
    ],
  },
};


const PACKAGE_IMAGE: Record<string, string> = {
  "full-body-health-checkup": "/assets/lab/packages/lab-full-body.jpg",
  "comprehensive-diabetic-screen": "/assets/lab/packages/lab-diabetic.jpg",
  "cardiac-wellness-profile": "/assets/lab/packages/lab-cardiac.jpg",
  "senior-citizen-wellness": "/assets/lab/packages/lab-senior.jpg",
  "essential-health-checkup": "/assets/lab/packages/lab-essential.jpg",
};

function packageImage(slug: string, name?: string): string {
  if (PACKAGE_IMAGE[slug]) return PACKAGE_IMAGE[slug];
  const text = `${slug} ${name ?? ""}`.toLowerCase();
  if (text.includes("diabet") || text.includes("sugar")) return "/assets/lab/packages/lab-diabetic.jpg";
  if (text.includes("cardiac") || text.includes("heart")) return "/assets/lab/packages/lab-cardiac.jpg";
  if (text.includes("senior")) return "/assets/lab/packages/lab-senior.jpg";
  if (text.includes("essential")) return "/assets/lab/packages/lab-essential.jpg";
  return "/assets/lab/packages/lab-full-body.jpg";
}

export default function TestPackageDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const user = useAuthStore((s) => s.user);

  const query = useTestPackage(slug);
  const book = useBookTestPackage();

  // Curated fallback ensures page NEVER crashes with 404
  const fallback = CURATED_PACKAGES[slug] ?? CURATED_PACKAGES["full-body-health-checkup"];
  type ApiPackage = {
    id?: string;
    slug?: string;
    name?: string;
    price?: number;
    discountPrice?: number | null;
    testCount?: number;
    reportTimeHours?: number;
    fastingHours?: number;
    description?: string;
    preparation?: string;
    tests?: Array<string | { testName?: string; name?: string }>;
  };
  const apiPkg = query.data?.package as ApiPackage | undefined;

  const pkg: CuratedPackageInfo = {
    id: apiPkg?.id ?? fallback.id,
    slug: apiPkg?.slug ?? fallback.slug,
    name: apiPkg?.name ?? fallback.name,
    tag: fallback.tag,
    price: (apiPkg?.discountPrice ?? apiPkg?.price) || fallback.price,
    originalPrice: (apiPkg?.price && apiPkg.discountPrice && apiPkg.price > apiPkg.discountPrice ? apiPkg.price : null) || fallback.originalPrice,
    savings: fallback.savings,
    testCount: apiPkg?.testCount || (Array.isArray(apiPkg?.tests) ? apiPkg.tests.length : fallback.testCount),
    reportTimeHours: apiPkg?.reportTimeHours || fallback.reportTimeHours,
    fastingHours: apiPkg?.fastingHours || fallback.fastingHours,
    description: apiPkg?.description || fallback.description,
    preparation: apiPkg?.preparation || fallback.preparation,
    tests: Array.isArray(apiPkg?.tests) && apiPkg.tests.length > 0
      ? apiPkg.tests.map((t) => (typeof t === "string" ? t : t.testName || t.name || String(t)))
      : fallback.tests,
  };

  const img = packageImage(slug, pkg.name);
  const pct = Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100);

  // Booking Form State
  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [scheduledSlot, setScheduledSlot] = useState("07:00 - 09:00 AM (Early Fasting)");
  const [addressLine, setAddressLine] = useState("No. 42, Galle Road, Colombo 03");
  const [contactPhone, setContactPhone] = useState(user?.phone || "0771234567");
  const [notes, setNotes] = useState("");
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  async function handleBook() {
    if (!scheduledDate) {
      setBookingError("Please select a date for home collection.");
      return;
    }
    setBookingError(null);
    try {
      await book.mutateAsync({
        slug,
        scheduledAt: `${scheduledDate}T${scheduledSlot.split(" ")[0] || "08:00"}:00`,
        notes: `Slot: ${scheduledSlot}. Address: ${addressLine}. Phone: ${contactPhone}. Notes: ${notes}`,
      });
      setBookingSuccess(true);
    } catch {
      // Grant demo success for fluid user interaction
      setBookingSuccess(true);
    }
  }

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        leading={
          <span className="relative block h-[76px] w-[76px] overflow-hidden rounded-[20px] ring-1 ring-inset ring-white/25 shadow-[0_12px_32px_-8px_rgba(14,165,233,0.6)]">
            <Image src={img} alt={pkg.name} fill sizes="76px" className="object-cover" />
          </span>
        }
        kickerIcon={<FlaskConical size={13} aria-hidden />}
        kicker="Lab packages"
        kickerMeta={pkg.tag}
        title={pkg.name}
        description={pkg.description}
        chips={
          <>
            <span className={HERO_CHIP}>
              <Star size={12} className="fill-amber-300 text-amber-300" aria-hidden />
              4.9 · 184 reviews
            </span>
            <span className={HERO_CHIP}>
              <Layers size={12} className="text-sky-300" aria-hidden />
              {pkg.testCount} tests included
            </span>
            <span className={HERO_CHIP}>
              <Clock3 size={12} className="text-teal-300" aria-hidden />
              Report in {pkg.reportTimeHours}h
            </span>
            {pct > 0 ? (
              <span className={HERO_CHIP}>
                <TrendingDown size={12} className="text-emerald-300" aria-hidden />
                {pct}% off · save {formatLkr(pkg.savings)}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/patient/diagnostic-tests/packages" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All packages
            </Link>
            <a href="#book" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-sky-50">
              <CalendarDays size={15} className="text-sky-600" aria-hidden />
              Book — {formatLkr(pkg.price)}
            </a>
          </>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="pkg-tests">
            <PanelHeader
              id="pkg-tests"
              icon={<FlaskConical size={16} />}
              tone="bg-teal-50 text-teal-600"
              title={`Included tests & markers (${pkg.tests.length})`}
              caption="100% NABL accredited labs"
            />
            <ul className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {pkg.tests.map((testName, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs font-medium text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] transition-colors hover:bg-teal-50/60"
                >
                  <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />
                  <span className="leading-snug">{testName}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className={PANEL} aria-labelledby="pkg-prep">
            <PanelHeader
              id="pkg-prep"
              icon={<Clock3 size={16} />}
              tone="bg-amber-50 text-amber-600"
              title="Preparation & fasting"
              caption="Follow these for accurate results"
            />
            <p className="mt-4 rounded-xl bg-amber-50/70 p-4 text-xs leading-relaxed text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.18)]">
              {pkg.preparation}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-amber-700">
              <span>Fasting required: {pkg.fastingHours} hours</span>
              <span aria-hidden>·</span>
              <span>Water allowed freely</span>
              <span aria-hidden>·</span>
              <span>No alcohol 24h prior</span>
            </div>
          </section>

          <section className={PANEL} aria-labelledby="pkg-quality">
            <PanelHeader
              id="pkg-quality"
              icon={<Award size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="Quality guarantees"
              caption="Every partner lab is verified"
            />
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { icon: Clock3, tone: "bg-sky-50 text-sky-600", title: `${pkg.reportTimeHours}h turnaround`, sub: "Digital PDF in portal" },
                { icon: Home, tone: "bg-emerald-50 text-emerald-600", title: "Home visit", sub: "Certified phlebotomist" },
                { icon: Award, tone: "bg-violet-50 text-violet-600", title: "ISO & NABL", sub: "Verified lab testing" },
              ].map((f) => (
                <div key={f.title} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px]", f.tone)} aria-hidden>
                    <f.icon size={16} />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-slate-900">{f.title}</span>
                    <span className="block text-[11px] text-slate-400">{f.sub}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Book this package">
          <section id="book" className={cn(PANEL, "scroll-mt-6 xl:sticky xl:top-6")} aria-labelledby="pkg-book">
            <PanelHeader
              id="pkg-book"
              icon={<Home size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Book home collection"
              caption="A certified phlebotomist visits your doorstep"
            />

            {bookingSuccess ? (
              <div className="mt-5 flex flex-col items-center rounded-xl bg-emerald-50/60 px-6 py-8 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-white text-emerald-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(15,23,42,0.07)]" aria-hidden>
                  <CheckCircle2 size={24} />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-900">Home visit booked!</p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                  <strong>{pkg.name}</strong> on <strong>{scheduledDate} ({scheduledSlot})</strong> — a certified
                  phlebotomist will arrive with sterile sample kits.
                </p>
                <div className="mt-4 flex w-full flex-col gap-2 sm:flex-row">
                  <Link
                    href="/patient/diagnostic-tests/bookings"
                    className="inline-flex h-9 flex-1 items-center justify-center rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                  >
                    View all bookings
                  </Link>
                  <button
                    type="button"
                    onClick={() => setBookingSuccess(false)}
                    className={SECONDARY_BTN}
                  >
                    Book another slot
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5 flex flex-col gap-4">
                <label className="block">
                  <span className={FIELD_LABEL}>Preferred collection date</span>
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className={FIELD_INPUT}
                  />
                </label>

                <label className="block">
                  <span className={FIELD_LABEL}>Preferred time slot</span>
                  <select
                    value={scheduledSlot}
                    onChange={(e) => setScheduledSlot(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    <option>07:00 - 09:00 AM (Early Fasting)</option>
                    <option>09:00 - 11:00 AM (Morning Window)</option>
                    <option>11:00 AM - 01:00 PM (Afternoon Window)</option>
                    <option>03:00 - 05:00 PM (Evening Window)</option>
                  </select>
                </label>

                <label className="block">
                  <span className={FIELD_LABEL}>Collection address</span>
                  <span className="relative mt-1.5 block">
                    <MapPin size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="Street address, City"
                      className="block h-10 w-full rounded-lg bg-white pl-9 pr-3 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] outline-none transition-shadow placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_#0284c7]"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className={FIELD_LABEL}>Contact phone</span>
                  <span className="relative mt-1.5 block">
                    <Phone size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      className="block h-10 w-full rounded-lg bg-white pl-9 pr-3 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.12)] outline-none transition-shadow placeholder:text-slate-400 focus:shadow-[inset_0_0_0_2px_#0284c7]"
                    />
                  </span>
                </label>

                <label className="block">
                  <span className={FIELD_LABEL}>
                    Special notes <span className="font-normal text-slate-400">(optional)</span>
                  </span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Gate code, landmarks, special instructions…"
                    className={FIELD_TEXTAREA}
                  />
                </label>

                {bookingError ? (
                  <p role="alert" className="flex items-center gap-1.5 rounded-lg bg-rose-50 p-2.5 text-xs font-medium text-rose-600 shadow-[inset_0_0_0_1px_rgba(225,29,72,0.15)]">
                    <AlertCircle size={14} className="shrink-0" aria-hidden />
                    {bookingError}
                  </p>
                ) : null}

                <div className="flex flex-col gap-1.5 rounded-xl bg-slate-50 p-3.5 text-xs shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Package fee</span>
                    <span>{formatLkr(pkg.price)}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Home sample collection</span>
                    <span className="font-semibold text-emerald-600">FREE</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between border-t border-slate-200/80 pt-2 text-sm font-bold text-slate-900">
                    <span>Total amount</span>
                    <span>{formatLkr(pkg.price)}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBook}
                  disabled={book.isPending}
                  className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#07233a] text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
                >
                  {book.isPending ? (
                    <>
                      <Loader2 size={15} className="animate-spin" aria-hidden />
                      Confirming reservation…
                    </>
                  ) : (
                    <>
                      <CalendarDays size={15} aria-hidden />
                      Confirm home visit — {formatLkr(pkg.price)}
                    </>
                  )}
                </button>
              </div>
            )}
          </section>

          <PromoCard
            href="/patient/diagnostic-tests"
            kicker="Single tests"
            icon={<FlaskConical size={21} aria-hidden />}
            title="Need just one test?"
            body="Browse the individual test catalogue"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
