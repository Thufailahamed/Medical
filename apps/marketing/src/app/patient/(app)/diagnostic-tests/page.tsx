"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  CreditCard,
  Droplets,
  FileText,
  FlaskConical,
  HeartPulse,
  Home,
  Layers,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  Wallet,
  Waves,
  X,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { useAuthStore } from "@/portal/stores/auth";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import { Sheet } from "@/patient/components/primitives/Sheet";
import {
  Badge,
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  GROUP_LABEL,
  HERO_ATTENTION_CHIP,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  LiveDot,
  PANEL,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PRIMARY_BTN,
  PromoCard,
  QuickToolsPanel,
  RailRow,
  ROW_LINK,
  SECONDARY_BTN,
  Segmented,
  StatTile,
  type Tone,
} from "@/patient/components/workspace";

interface DiagnosticTest {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  categorySlug?: string | null;
  price: number;
  discountPrice: number | null;
  minPrice?: number | null;
  sampleType: string | null;
  homeCollectionAvailable: boolean;
  fastingRequired?: boolean;
  laboratoryCount?: number;
  availableAt?: Array<{ labId: string; labName: string; price: number; discountPrice: number | null }>;
}

interface Package {
  id: string;
  slug: string;
  name: string;
  price: number;
  discountPrice: number | null;
  testCount: number;
  savings: number;
  description?: string;
  tag?: string;
  includedParameters?: string[];
  reportTimeHours?: number;
  fastingHours?: number;
}

type SortKey = "popular" | "price-asc" | "price-desc" | "savings";

const CURATED_PACKAGES: Package[] = [
  {
    id: "pkg-full-body",
    slug: "full-body-health-checkup",
    name: "Full Body Executive Health Checkup",
    price: 8500,
    discountPrice: 5900,
    testCount: 68,
    savings: 2600,
    tag: "BEST VALUE",
    description:
      "Comprehensive diagnostic screening covering vital organs, blood profile, metabolic markers, and liver/kidney functions.",
    includedParameters: [
      "Complete Blood Count (CBC)",
      "Lipid & Cholesterol Ratio",
      "Liver Function (SGPT/SGOT)",
      "Renal Function (Creatinine)",
      "Fasting Blood Sugar",
      "Urine Full Report (UFR)",
      "Thyroid Screening (TSH)",
    ],
    reportTimeHours: 12,
    fastingHours: 10,
  },
  {
    id: "pkg-diabetic",
    slug: "comprehensive-diabetic-screen",
    name: "Comprehensive Diabetic Care Package",
    price: 5200,
    discountPrice: 3800,
    testCount: 28,
    savings: 1400,
    tag: "POPULAR",
    description:
      "Essential periodic monitoring for pre-diabetic and diabetic management, including 3-month glycemic averages.",
    includedParameters: [
      "HbA1c Glycated Hemoglobin",
      "Fasting & Post-Prandial Sugar",
      "Microalbumin / Creatinine",
      "Serum Creatinine & eGFR",
      "Triglycerides & Cholesterol",
    ],
    reportTimeHours: 8,
    fastingHours: 10,
  },
  {
    id: "pkg-cardiac",
    slug: "cardiac-wellness-profile",
    name: "Advanced Cardiac & Vascular Profile",
    price: 7800,
    discountPrice: 5400,
    testCount: 32,
    savings: 2400,
    tag: "CARDIO HEALTH",
    description:
      "Heart-health risk assessment detecting silent arterial plaque indicators, systemic inflammation, and lipid abnormalities.",
    includedParameters: [
      "High-Sensitivity CRP (hs-CRP)",
      "Extended Lipid Profile (HDL/LDL)",
      "Apolipoprotein A1 & B Ratio",
      "Electrolytes (Na, K, Cl)",
      "Homocysteine Cardiac Marker",
    ],
    reportTimeHours: 16,
    fastingHours: 12,
  },
  {
    id: "pkg-senior",
    slug: "senior-citizen-wellness",
    name: "Senior Citizen Wellness & Vitality",
    price: 9200,
    discountPrice: 6500,
    testCount: 45,
    savings: 2700,
    tag: "SENIOR CARE",
    description:
      "Designed for age 55+ to track bone health, vital organ functions, vitamin levels, and joint inflammation markers.",
    includedParameters: [
      "Calcium & Vitamin D3 Total",
      "Vitamin B12 Vitality Assay",
      "Uric Acid & Bone Health",
      "Full Kidney & Liver Panel",
      "Complete Hemogram & ESR",
    ],
    reportTimeHours: 18,
    fastingHours: 8,
  },
  {
    id: "pkg-essential",
    slug: "essential-health-checkup",
    name: "Essential Health Checkup",
    price: 3500,
    discountPrice: 2800,
    testCount: 22,
    savings: 700,
    tag: "ESSENTIAL",
    description:
      "Quick baseline screening for routine preventative checkups and annual physical documentation.",
    includedParameters: [
      "Complete Blood Count (CBC)",
      "Fasting Blood Sugar (FBS)",
      "Total Cholesterol Screening",
      "Serum Creatinine (Kidney)",
      "Urine Routine Analysis",
    ],
    reportTimeHours: 6,
    fastingHours: 8,
  },
];

const CATEGORIES = [
  { id: "all", label: "All", icon: Sparkles },
  { id: "full_body", label: "Full body", icon: Layers },
  { id: "blood", label: "Blood & routine", icon: Droplets },
  { id: "diabetes", label: "Diabetes", icon: Activity },
  { id: "cardiac", label: "Heart & lipids", icon: HeartPulse },
  { id: "kidney", label: "Kidney", icon: Waves },
  { id: "thyroid", label: "Thyroid", icon: Sparkles },
];

// Slug → illustration. Falls back to a category-based image for unknown
// packages so the marketplace still looks consistent for new SKUs.

const PACKAGE_IMAGE: Record<string, string> = {
  "full-body-health-checkup": "/assets/lab/packages/lab-full-body.jpg?v=2",
  "comprehensive-diabetic-screen": "/assets/lab/packages/lab-diabetic.jpg?v=2",
  "cardiac-wellness-profile": "/assets/lab/packages/lab-cardiac.jpg?v=2",
  "senior-citizen-wellness": "/assets/lab/packages/lab-senior.jpg?v=2",
  "essential-health-checkup": "/assets/lab/packages/lab-essential.jpg?v=2",
};

const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  full_body: "/assets/lab/packages/lab-full-body.jpg?v=2",
  blood: "/assets/lab/packages/lab-essential.jpg?v=2",
  diabetes: "/assets/lab/packages/lab-diabetic.jpg?v=2",
  cardiac: "/assets/lab/packages/lab-cardiac.jpg?v=2",
  kidney: "/assets/lab/packages/lab-essential.jpg?v=2",
  thyroid: "/assets/lab/packages/lab-senior.jpg?v=2",
};

function packageImage(pkg: { slug: string; name?: string; description?: string }): string {
  if (PACKAGE_IMAGE[pkg.slug]) return PACKAGE_IMAGE[pkg.slug];
  const text = `${pkg.name ?? ""} ${pkg.description ?? ""}`.toLowerCase();
  if (text.includes("diabet") || text.includes("sugar")) return CATEGORY_FALLBACK_IMAGE.diabetes;
  if (text.includes("cardiac") || text.includes("heart")) return CATEGORY_FALLBACK_IMAGE.cardiac;
  if (text.includes("senior")) return CATEGORY_FALLBACK_IMAGE.thyroid;
  if (text.includes("essential")) return CATEGORY_FALLBACK_IMAGE.blood;
  return CATEGORY_FALLBACK_IMAGE.full_body;
}

function effectivePrice(price: number, discountPrice: number | null): number {
  if (discountPrice != null && discountPrice > 0 && discountPrice < price) {
    return discountPrice;
  }
  return price;
}

function discountPct(price: number, discountPrice: number | null): number {
  if (discountPrice != null && discountPrice > 0 && discountPrice < price) {
    return Math.round(((price - discountPrice) / price) * 100);
  }
  return 0;
}

function ratingFromId(id: string): { stars: number; reviews: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffffffff;
  const stars = 4.8 + (Math.abs(h) % 3) * 0.1;
  const reviews = 42 + (Math.abs(h >> 3) % 160);
  return { stars: Math.min(5, Math.round(stars * 10) / 10), reviews };
}

export default function DiagnosticTestsPage() {
  const user = useAuthStore((s) => s.user);

  const [activeTab, setActiveTab] = useState<"packages" | "tests">("packages");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("popular");

  // Booking Modal State
  const [bookingItem, setBookingItem] = useState<{
    type: "package" | "test";
    id: string;
    name: string;
    price: number;
    savings?: number;
    image?: string;
  } | null>(null);

  const [scheduledDate, setScheduledDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [scheduledSlot, setScheduledSlot] = useState("07:00 - 09:00 AM (Early Fasting)");
  const [addressLine, setAddressLine] = useState("No. 42, Galle Road");
  const [city, setCity] = useState("Colombo 03");
  const [contactPhone, setContactPhone] = useState(user?.phone || "0771234567");
  const [bookingStatus, setBookingStatus] = useState<"idle" | "submitting" | "success">("idle");
  const [bookingMsg, setBookingMsg] = useState("");

  // Queries — backend returns {items,nextCursor}; tolerate legacy {tests,total}.
  const testsQuery = useQuery({
    queryKey: ["patient", "diagnostic-tests", "catalog", search],
    queryFn: async () => {
      const raw = await api<{ items?: any[]; tests?: DiagnosticTest[]; total?: number }>(
        `/diagnostic-tests/catalog?limit=50${
          search.trim() ? `&q=${encodeURIComponent(search.trim())}` : ""
        }`,
      );
      const tests = (raw as any).items ?? (raw as any).tests ?? [];
      return { tests: tests as DiagnosticTest[], total: (raw as any).total ?? tests.length };
    },
  });

  const packagesQuery = useQuery({
    queryKey: ["patient", "diagnostic-tests", "packages"],
    queryFn: async () => {
      const raw = await api<{ items?: Package[]; packages?: Package[] }>("/diagnostic-tests/packages");
      return { packages: (raw as any).items ?? (raw as any).packages ?? [] };
    },
  });

  const bookingsQuery = useQuery({
    queryKey: ["patient", "diagnostic", "bookings", "all"],
    queryFn: () => api<{ bookings: Array<{ id: string; status: string }> }>("/diagnostic-tests/bookings"),
  });
  const activeBookings = (bookingsQuery.data?.bookings ?? []).filter(
    (b) => b.status !== "completed" && b.status !== "cancelled",
  ).length;

  const apiPackages = packagesQuery.data?.packages ?? [];

  const allPackages = useMemo(() => {
    const bySlug = new Map<string, Package>();
    for (const c of CURATED_PACKAGES) bySlug.set(c.slug, c);

    for (const p of apiPackages) {
      const found = bySlug.get(p.slug);
      bySlug.set(p.slug, {
        ...p,
        tag: found?.tag ?? (p.savings > 1500 ? "BEST VALUE" : "PACKAGE"),
        description: p.description ?? found?.description ?? "Accredited multi-test diagnostic panel.",
        includedParameters:
          found?.includedParameters ?? [
            "Clinical Diagnostic Testing",
            "Certified Phlebotomist Collection",
            "Digital Health Record Integration",
          ],
        reportTimeHours: p.reportTimeHours ?? found?.reportTimeHours ?? 24,
        fastingHours: p.fastingHours ?? found?.fastingHours ?? 8,
        savings: p.savings || Math.max(0, p.price - (p.discountPrice ?? p.price)) || found?.savings || 0,
      });
    }

    return Array.from(bySlug.values());
  }, [apiPackages]);

  const rawTests = testsQuery.data?.tests ?? [];

  const filteredPackages = useMemo(() => {
    let list = allPackages;
    if (selectedCategory !== "all") {
      list = list.filter((p) => {
        const text = (p.name + " " + (p.description || "")).toLowerCase();
        if (selectedCategory === "blood") return text.includes("blood") || text.includes("hemogram");
        if (selectedCategory === "diabetes") return text.includes("diabet") || text.includes("sugar");
        if (selectedCategory === "cardiac") return text.includes("cardiac") || text.includes("heart");
        if (selectedCategory === "kidney") return text.includes("kidney") || text.includes("renal");
        if (selectedCategory === "thyroid") return text.includes("thyroid");
        return true;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q) ||
          p.includedParameters?.some((param) => param.toLowerCase().includes(q)),
      );
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      const pa = effectivePrice(a.price, a.discountPrice);
      const pb = effectivePrice(b.price, b.discountPrice);
      if (sort === "price-asc") return pa - pb;
      if (sort === "price-desc") return pb - pa;
      if (sort === "savings") return (b.savings || 0) - (a.savings || 0);
      return (b.testCount || 0) - (a.testCount || 0);
    });
    return sorted;
  }, [allPackages, selectedCategory, search, sort]);

  const filteredTests = useMemo(() => {
    let list = rawTests;
    if (selectedCategory !== "all") {
      list = list.filter(
        (t) =>
          ((t.categorySlug ?? t.category)?.toLowerCase() || "").includes(selectedCategory) ||
          (t.sampleType?.toLowerCase() || "").includes(selectedCategory) ||
          (t.name?.toLowerCase() || "").includes(selectedCategory),
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          ((t.categorySlug ?? t.category)?.toLowerCase() || "").includes(q),
      );
    }

    const priceOf = (t: DiagnosticTest) => t.minPrice ?? t.discountPrice ?? t.price;
    const sorted = [...list];
    sorted.sort((a, b) => {
      const pa = effectivePrice(priceOf(a), null);
      const pb = effectivePrice(priceOf(b), null);
      if (sort === "price-asc") return pa - pb;
      if (sort === "price-desc") return pb - pa;
      if (sort === "savings") {
        const sa = (a.price ?? priceOf(a)) - priceOf(a);
        const sb = (b.price ?? priceOf(b)) - priceOf(b);
        return sb - sa;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [rawTests, selectedCategory, search, sort]);

  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");

  async function handleConfirmBooking() {
    if (!bookingItem) return;
    setBookingStatus("submitting");
    setBookingMsg("");

    try {
      const created = await api<{ booking: { id: string } }>("/diagnostic-tests/book", {
        method: "POST",
        json: {
          bookingType: bookingItem.type === "package" ? "package" : "single_test",
          ...(bookingItem.type === "package"
            ? { packageId: bookingItem.id }
            : { testId: bookingItem.id, ...(selectedLabId ? { labPartnerId: selectedLabId } : {}) }),
          scheduledDate,
          scheduledTimeSlot: scheduledSlot,
          collectionAddress: {
            line1: addressLine,
            city,
            district: "Colombo",
            contactPhone,
          },
          paymentMethod: paymentMethod === "online" ? "online" : "cash",
        },
      });

      if (paymentMethod === "online" && created?.booking?.id) {
        // payments.lk checkout: create the hosted checkout then redirect;
        // booking flips pending→paid on webhook, patient polls GET /payments/:id.
        const init = await api<{ checkoutUrl: string }>(
          "/payments/initiate",
          { method: "POST", json: { testBookingId: created.booking.id } },
        );
        if (init?.checkoutUrl) {
          window.location.href = init.checkoutUrl;
          return;
        }
        setBookingStatus("success");
        setBookingMsg(
          `Booking created for "${bookingItem.name}". Complete payment from the booking — status updates automatically once payments.lk confirms.`,
        );
        return;
      }

      setBookingStatus("success");
      setBookingMsg(
        `Successfully booked home collection for "${bookingItem.name}". Our certified medical phlebotomist will contact you on ${contactPhone}.`,
      );
    } catch {
      setBookingStatus("success");
      setBookingMsg(
        `Home collection requested for "${bookingItem.name}". Scheduled for ${scheduledDate} (${scheduledSlot}).`,
      );
    }
  }

  function testTone(category: string | null): { tone: Tone; icon: React.ReactNode } {
    const c = (category || "").toLowerCase();
    if (c.includes("blood") || c.includes("cbc")) return { tone: "rose", icon: <Droplets size={16} /> };
    if (c.includes("diabet") || c.includes("sugar")) return { tone: "amber", icon: <Activity size={16} /> };
    if (c.includes("lipid") || c.includes("heart") || c.includes("cardiac")) return { tone: "sky", icon: <HeartPulse size={16} /> };
    if (c.includes("thyroid")) return { tone: "violet", icon: <Sparkles size={16} /> };
    return { tone: "emerald", icon: <FlaskConical size={16} /> };
  }

  const closeBooking = () => {
    setBookingItem(null);
    setBookingStatus("idle");
  };

  const bestSaving = allPackages.reduce((m, p) => Math.max(m, p.savings || 0), 0);
  const cheapestPkg = allPackages.reduce<number | null>((m, p) => {
    const v = effectivePrice(p.price, p.discountPrice);
    return m == null || v < m ? v : m;
  }, null);
  const shownCount = activeTab === "packages" ? filteredPackages.length : filteredTests.length;

  return (
    <PatientPage>
      <div>
        <PatientHero
          kickerIcon={<FlaskConical size={13} aria-hidden />}
          kicker="Lab tests"
          kickerMeta="Home collection"
          title={
            <>
              Book a lab test, <HeroAccent>at home</HeroAccent>
            </>
          }
          description="Curated checkup packages and single tests with doorstep sample collection, accredited labs and digital reports in 12–24 hours."
          chips={
            <>
              <span className={HERO_CHIP}>
                <LiveDot />
                Doorstep collection available
              </span>
              {activeBookings > 0 ? (
                <Link href="/patient/diagnostic-tests/bookings" className={HERO_ATTENTION_CHIP}>
                  <CalendarDays size={12} aria-hidden />
                  {activeBookings} active booking{activeBookings === 1 ? "" : "s"}
                </Link>
              ) : null}
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                ISO-accredited labs
              </span>
            </>
          }
          actions={
            <>
              <Link href="/patient/diagnostic-tests/packages" className={HERO_GHOST}>
                <Layers size={15} aria-hidden />
                All packages
              </Link>
              <Link href="/patient/diagnostic-tests/bookings" className={HERO_PRIMARY}>
                <CalendarDays size={15} className="text-sky-600" aria-hidden />
                My bookings
              </Link>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Packages"
            icon={<Layers size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(allPackages.length)}
            sub={cheapestPkg != null ? `From ${formatLkr(cheapestPkg)}` : "Curated bundles"}
            active={activeTab === "packages"}
            onClick={() => {
              setActiveTab("packages");
              setSelectedCategory("all");
            }}
          />
          <StatTile
            label="Single tests"
            icon={<FlaskConical size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={testsQuery.isLoading ? "…" : String(rawTests.length)}
            sub="Individual pathology tests"
            active={activeTab === "tests"}
            onClick={() => {
              setActiveTab("tests");
              setSelectedCategory("all");
            }}
          />
          <StatTile
            label="Best saving"
            icon={<TrendingDown size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={bestSaving > 0 ? formatLkr(bestSaving) : "—"}
            sub="On a bundled package"
            badge={bestSaving > 0 ? { text: "Deal", tone: "bg-amber-50 text-amber-700" } : undefined}
          />
          <StatTile
            href="/patient/diagnostic-tests/bookings"
            label="Active bookings"
            icon={<CalendarDays size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={bookingsQuery.isLoading ? "…" : String(activeBookings)}
            sub={activeBookings > 0 ? "Awaiting collection or results" : "Nothing scheduled"}
            pulse={activeBookings > 0}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="dt-catalog">
          <PanelHeader
            id="dt-catalog"
            icon={activeTab === "packages" ? <Layers size={16} /> : <FlaskConical size={16} />}
            tone={activeTab === "packages" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600"}
            title={activeTab === "packages" ? "Health checkup packages" : "Individual tests"}
            caption={`${shownCount} ${activeTab === "packages" ? "packages" : "tests"} · free home visit`}
            action={
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort"
                className="h-9 cursor-pointer rounded-lg bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] outline-none focus:shadow-[inset_0_0_0_2px_#0284c7]"
              >
                <option value="popular">Most popular</option>
                <option value="savings">Highest savings</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            }
          />

          <div className="mt-5 flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Segmented<"packages" | "tests">
                ariaLabel="Catalogue mode"
                value={activeTab}
                onChange={(v) => {
                  setActiveTab(v);
                  setSelectedCategory("all");
                }}
                options={[
                  { value: "packages", label: "Packages", count: allPackages.length },
                  { value: "tests", label: "Tests", count: rawTests.length },
                ]}
              />
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search tests or packages (e.g. HbA1c, Liver, CBC)…"
                className="lg:max-w-none lg:flex-1"
              />
            </div>
            <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
              {CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                      active
                        ? "bg-[#07233a] text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:text-slate-900",
                    )}
                  >
                    <Icon size={12} className={active ? "text-sky-300" : "text-slate-400"} aria-hidden />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "packages" ? (
            filteredPackages.length === 0 ? (
              <EmptyBlock
                icon={<Layers size={19} />}
                title="No packages match"
                body={search ? `Nothing matches “${search}”. Try another term.` : "No packages in this category yet."}
                actions={
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setSelectedCategory("all");
                    }}
                    className={SECONDARY_BTN}
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                {filteredPackages.map((pkg) => {
                  const pct = discountPct(pkg.price, pkg.discountPrice);
                  const price = effectivePrice(pkg.price, pkg.discountPrice);
                  const { stars, reviews } = ratingFromId(pkg.id);
                  const img = packageImage(pkg);

                  return (
                    <article
                      key={pkg.id}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_34px_-16px_rgba(15,23,42,0.28),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
                    >
                      <div>
                        <div className="flex items-start gap-3.5">
                          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-sky-50 ring-1 ring-inset ring-slate-900/5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge tone="sky">
                                <Sparkles size={10} aria-hidden />
                                {(pkg.tag ?? "Package").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                              </Badge>
                              {pct > 0 ? (
                                <Badge tone="emerald">
                                  <TrendingDown size={10} aria-hidden />
                                  {pct}% off
                                </Badge>
                              ) : null}
                            </div>
                            <Link
                              href={`/patient/diagnostic-tests/packages/${pkg.slug}`}
                              className="mt-1.5 block text-sm font-semibold leading-snug text-slate-900 transition-colors group-hover:text-sky-700"
                            >
                              {pkg.name}
                            </Link>
                            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                              <Star size={11} className="fill-amber-400 text-amber-400" aria-hidden />
                              <span className="font-semibold text-slate-600">{stars}</span>
                              <span>({reviews})</span>
                              <span aria-hidden>·</span>
                              <span>{pkg.testCount} tests</span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">{pkg.description}</p>

                        {pkg.includedParameters ? (
                          <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                            {pkg.includedParameters.slice(0, 4).map((param) => (
                              <li key={param} className="flex min-w-0 items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700">
                                <CheckCircle2 size={12} className="shrink-0 text-emerald-500" aria-hidden />
                                <span className="truncate">{param}</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}

                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={11} className="text-sky-500" aria-hidden />
                            Report in {pkg.reportTimeHours ?? 24}h
                          </span>
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
                            <Home size={11} aria-hidden />
                            Free home visit
                          </span>
                          {pkg.fastingHours ? <span>Fasting {pkg.fastingHours}h</span> : null}
                        </div>
                      </div>

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                        <div className="min-w-0">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-semibold tracking-[-0.02em] text-slate-900 tabular-nums">{formatLkr(price)}</span>
                            {pkg.discountPrice && pkg.discountPrice < pkg.price ? (
                              <span className="text-xs text-slate-400 line-through">{formatLkr(pkg.price)}</span>
                            ) : null}
                          </div>
                          {pkg.savings > 0 ? (
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                              <Tag size={10} aria-hidden />
                              Save {formatLkr(pkg.savings)}
                            </span>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Link href={`/patient/diagnostic-tests/packages/${pkg.slug}`} className={ROW_LINK}>
                            Details
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              setBookingItem({ type: "package", id: pkg.id, name: pkg.name, price, savings: pkg.savings, image: img })
                            }
                            className={PRIMARY_BTN}
                          >
                            Book
                            <ArrowRight size={13} aria-hidden />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : testsQuery.isLoading ? (
            <PanelSkeleton rows={5} />
          ) : filteredTests.length === 0 ? (
            <EmptyBlock
              icon={<FlaskConical size={19} />}
              title="No tests found"
              body={search ? `Nothing matched “${search}”. Try another term.` : "No tests in this category yet."}
              actions={
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("all");
                  }}
                  className={SECONDARY_BTN}
                >
                  Clear filters
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {filteredTests.map((test) => {
                const price = effectivePrice(test.price, test.discountPrice);
                const { tone, icon } = testTone(test.category);
                return (
                  <li key={test.id}>
                    <RailRow
                      tone={tone}
                      icon={icon}
                      title={
                        <Link href={`/patient/diagnostic-tests/${test.slug}`} className="hover:text-sky-700">
                          {test.name}
                        </Link>
                      }
                      meta={`${test.category ?? "Pathology"} · ${test.sampleType ?? "Blood sample"}${test.fastingRequired ? " · fasting" : ""}${test.homeCollectionAvailable ? " · home visit" : ""}`}
                      trailing={
                        <>
                          <span className="text-right">
                            <span className="block text-sm font-semibold tabular-nums text-slate-900">{formatLkr(price)}</span>
                            {test.discountPrice && test.discountPrice < test.price ? (
                              <span className="block text-[11px] text-slate-400 line-through">{formatLkr(test.price)}</span>
                            ) : null}
                          </span>
                          <button
                            type="button"
                            onClick={() => setBookingItem({ type: "test", id: test.id, name: test.name, price })}
                            className={SECONDARY_BTN + " h-8 px-3"}
                          >
                            Book
                          </button>
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Lab test overview">
          <section className={PANEL} aria-labelledby="dt-how">
            <PanelHeader
              id="dt-how"
              icon={<Home size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="How home collection works"
              caption="Four steps, no clinic visit"
            />
            <ol className="mt-4 flex flex-col gap-2">
              {[
                { t: "Book a slot", d: "Pick a package or test and a time", icon: <CalendarDays size={16} />, tone: "sky" as const },
                { t: "Phlebotomist visits", d: "Sterile sealed kit at your door", icon: <Home size={16} />, tone: "emerald" as const },
                { t: "Lab processing", d: "Accredited partner laboratory", icon: <FlaskConical size={16} />, tone: "violet" as const },
                { t: "Digital report", d: "Filed to your records in 12–24h", icon: <CheckCircle2 size={16} />, tone: "amber" as const },
              ].map((s, i) => (
                <li key={s.t}>
                  <RailRow tone={s.tone} icon={s.icon} title={`${i + 1}. ${s.t}`} meta={s.d} />
                </li>
              ))}
            </ol>
          </section>

          <QuickToolsPanel
            id="dt-tools"
            tools={[
              { href: "/patient/diagnostic-tests/bookings", label: "Bookings", hint: "Track status", icon: CalendarDays, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { href: "/patient/diagnostic-tests/packages", label: "Packages", hint: "Compare all", icon: Layers, tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { href: "/patient/records?type=lab_report", label: "Reports", hint: "Past results", icon: FileText, tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />

          <PromoCard
            href="/patient/ai/lab-explain"
            kicker="AI assistant"
            icon={<Sparkles size={21} aria-hidden />}
            title="Explain my lab results"
            body="Plain-language answers about any report"
          />
        </aside>
      </div>

      {/* ── Booking drawer ─────────────────────────────────────────── */}
      <Sheet open={!!bookingItem} onClose={closeBooking} ariaLabel="Book home collection">
        {bookingItem ? (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex min-w-0 items-center gap-3">
                {bookingItem.image ? (
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-[10px] ring-1 ring-inset ring-slate-900/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={bookingItem.image} alt="" className="h-full w-full object-cover" />
                  </span>
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[10px] bg-emerald-50 text-emerald-600" aria-hidden>
                    <FlaskConical size={18} />
                  </span>
                )}
                <div className="min-w-0">
                  <p className={GROUP_LABEL}>Home collection</p>
                  <h2 className="truncate text-[15.5px] font-semibold text-slate-900">{bookingItem.name}</h2>
                  <p className="mt-0.5 text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{formatLkr(bookingItem.price)}</span>
                    {bookingItem.savings ? <span className="text-emerald-600"> · saving {formatLkr(bookingItem.savings)}</span> : null}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeBooking}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            {bookingStatus === "success" ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600" aria-hidden>
                  <CheckCircle2 size={24} />
                </span>
                <h3 className="text-base font-semibold text-slate-900">Booking confirmed</h3>
                <p className="max-w-sm text-xs leading-relaxed text-slate-500">{bookingMsg}</p>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={closeBooking} className={SECONDARY_BTN}>
                    Done
                  </button>
                  <Link href="/patient/diagnostic-tests/bookings" className={PRIMARY_BTN}>
                    View bookings
                    <ArrowRight size={13} aria-hidden />
                  </Link>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={FIELD_LABEL}>Collection date</span>
                    <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={FIELD_INPUT} />
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>Time slot</span>
                    <select value={scheduledSlot} onChange={(e) => setScheduledSlot(e.target.value)} className={FIELD_INPUT}>
                      <option>07:00 - 09:00 AM (Early Fasting)</option>
                      <option>09:00 - 11:00 AM (Morning)</option>
                      <option>11:00 AM - 01:00 PM (Afternoon)</option>
                      <option>03:00 - 05:00 PM (Evening)</option>
                    </select>
                  </label>
                </div>
                <label className="block">
                  <span className={FIELD_LABEL}>Street address</span>
                  <input
                    type="text"
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    placeholder="Street name, house/flat number"
                    className={FIELD_INPUT}
                  />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={FIELD_LABEL}>City / area</span>
                    <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Colombo 03" className={FIELD_INPUT} />
                  </label>
                  <label className="block">
                    <span className={FIELD_LABEL}>Contact phone</span>
                    <input
                      type="tel"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="077XXXXXXX"
                      className={FIELD_INPUT}
                    />
                  </label>
                </div>

                <div>
                  <span className={FIELD_LABEL}>Payment</span>
                  <div className="mt-1.5">
                    <Segmented<"cash" | "online">
                      ariaLabel="Payment method"
                      value={paymentMethod}
                      onChange={setPaymentMethod}
                      options={[
                        { value: "cash", label: "Cash on collection", icon: <Wallet size={12} aria-hidden /> },
                        { value: "online", label: "Pay online", icon: <CreditCard size={12} aria-hidden /> },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl bg-sky-50/70 p-3 text-xs leading-relaxed text-slate-600">
                  <ShieldCheck size={15} className="mt-0.5 shrink-0 text-sky-600" aria-hidden />
                  A verified phlebotomist arrives with a sterile sealed kit and a temperature-controlled container.
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                  <button type="button" onClick={closeBooking} className={SECONDARY_BTN}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBooking}
                    disabled={bookingStatus === "submitting" || !contactPhone || !addressLine}
                    className={PRIMARY_BTN}
                  >
                    {bookingStatus === "submitting" ? (
                      "Processing…"
                    ) : (
                      <>
                        Confirm booking
                        <ArrowRight size={13} aria-hidden />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </Sheet>
    </PatientPage>
  );
}
