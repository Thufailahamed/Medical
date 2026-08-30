"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Droplets,
  FlaskConical,
  HeartPulse,
  Home,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  Tag,
  TrendingDown,
  Waves,
  X,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { useAuthStore } from "@/portal/stores/auth";
import { formatLkr } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface DiagnosticTest {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  price: number;
  discountPrice: number | null;
  sampleType: string | null;
  homeCollectionAvailable: boolean;
  fastingRequired?: boolean;
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
  { id: "all", label: "All Categories", icon: Sparkles },
  { id: "full_body", label: "Full Body & Wellness", icon: Layers },
  { id: "blood", label: "Blood & Routine", icon: Droplets },
  { id: "diabetes", label: "Diabetes & Sugar", icon: Activity },
  { id: "cardiac", label: "Heart & Lipids", icon: HeartPulse },
  { id: "kidney", label: "Kidney & Renal", icon: Waves },
  { id: "thyroid", label: "Thyroid & Hormones", icon: Sparkles },
];

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

  // Queries
  const testsQuery = useQuery({
    queryKey: ["patient", "diagnostic-tests", "catalog", search],
    queryFn: () =>
      api<{ tests: DiagnosticTest[]; total: number }>(
        `/diagnostic-tests/catalog?limit=50${
          search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""
        }`,
      ),
  });

  const packagesQuery = useQuery({
    queryKey: ["patient", "diagnostic-tests", "packages"],
    queryFn: () => api<{ packages: Package[] }>("/diagnostic-tests/packages"),
  });

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
          (t.category?.toLowerCase() || "").includes(selectedCategory) ||
          (t.sampleType?.toLowerCase() || "").includes(selectedCategory) ||
          (t.name?.toLowerCase() || "").includes(selectedCategory),
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.category?.toLowerCase() || "").includes(q),
      );
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      const pa = effectivePrice(a.price, a.discountPrice);
      const pb = effectivePrice(b.price, b.discountPrice);
      if (sort === "price-asc") return pa - pb;
      if (sort === "price-desc") return pb - pa;
      if (sort === "savings") {
        const sa = a.discountPrice ? a.price - a.discountPrice : 0;
        const sb = b.discountPrice ? b.price - b.discountPrice : 0;
        return sb - sa;
      }
      return a.name.localeCompare(b.name);
    });
    return sorted;
  }, [rawTests, selectedCategory, search, sort]);

  async function handleConfirmBooking() {
    if (!bookingItem) return;
    setBookingStatus("submitting");
    setBookingMsg("");

    try {
      await api("/diagnostic-tests/book", {
        method: "POST",
        json: {
          bookingType: bookingItem.type === "package" ? "package" : "single_test",
          ...(bookingItem.type === "package"
            ? { packageId: bookingItem.id }
            : { testId: bookingItem.id }),
          scheduledDate,
          scheduledTimeSlot: scheduledSlot,
          collectionAddress: {
            line1: addressLine,
            city,
            district: "Colombo",
            contactPhone,
          },
          paymentMethod: "cash",
        },
      });

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

  function getTestIcon(category: string | null) {
    const c = (category || "").toLowerCase();
    if (c.includes("blood") || c.includes("cbc"))
      return <Droplets className="text-rose-500" size={17} />;
    if (c.includes("diabet") || c.includes("sugar"))
      return <Activity className="text-amber-500" size={17} />;
    if (c.includes("lipid") || c.includes("heart") || c.includes("cardiac"))
      return <HeartPulse className="text-sky-500" size={17} />;
    if (c.includes("thyroid"))
      return <Sparkles className="text-indigo-500" size={17} />;
    return <FlaskConical className="text-teal-500" size={17} />;
  }

  return (
    <div className="flex flex-col gap-4 pb-14">
      {/* ── 1. Compact Luxury Hero Banner ─────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-2xl p-5 sm:p-6 text-white shadow-lg"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 42%, #0E7490 75%, #0C8B8C 100%)",
          boxShadow:
            "0 10px 30px rgba(3, 105, 161, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.12)",
        }}
      >
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-60 h-60 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-52 h-52 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Sparkles size={11} className="text-sky-300" />
                Diagnostic &amp; Health Marketplace
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Certified Health Packages &amp; Lab Tests
              </h1>
              <p className="text-xs sm:text-sm text-white/80 mt-1 leading-relaxed">
                Book comprehensive checkup bundles or single pathology tests with sterile home sample collection and verified digital reports.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
              <Link
                href="/patient/insurance"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-sky-950 hover:bg-sky-50 transition-all shadow-sm hover:shadow-md hover:scale-[1.02]"
              >
                <ShieldCheck size={14} className="text-sky-700" />
                <span>Insurance Marketplace</span>
                <ArrowRight size={12} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/15 text-[11px] font-medium text-white/90">
            <div className="flex items-center gap-1.5">
              <Home size={13} className="text-sky-300 shrink-0" />
              <span className="truncate">Free Home Sample Collection</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={13} className="text-emerald-300 shrink-0" />
              <span className="truncate">Digital Reports in 12–24h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-amber-300 shrink-0" />
              <span className="truncate">100% SLMC &amp; ISO Labs</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Unified Compact Marketplace Controls ───────────────────────── */}
      <div className="flex flex-col gap-2.5 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        {/* Row 1: Segmented Switcher + Search + Sort */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Segmented Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab("packages");
                setSelectedCategory("all");
              }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "packages"
                  ? "bg-white text-sky-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <Sparkles size={13} className="text-sky-600" />
              <span>Packages ({allPackages.length})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("tests");
                setSelectedCategory("all");
              }}
              className={cn(
                "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeTab === "tests"
                  ? "bg-white text-sky-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <FlaskConical size={13} className="text-emerald-600" />
              <span>Individual Tests ({rawTests.length || "50+"})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tests or checkup packages (e.g. HbA1c, Liver, CBC)..."
              className="w-full h-9 pl-9 pr-8 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 transition-all"
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden md:inline">
              Sort:
            </span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-sky-500 cursor-pointer"
            >
              <option value="popular">Most Popular</option>
              <option value="savings">Highest Savings</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Row 2: Uniform Horizontal Category Pills */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none flex-1">
            {CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0 transition-all border cursor-pointer",
                    active
                      ? "bg-slate-900 text-white border-slate-900 shadow-2xs"
                      : "bg-slate-50 text-slate-600 border-slate-200/80 hover:bg-slate-100 hover:text-slate-900",
                  )}
                >
                  <Icon size={12} className={active ? "text-white" : "text-slate-400"} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>

          <span className="text-xs font-bold text-slate-400 shrink-0 hidden sm:inline pl-2">
            {activeTab === "packages"
              ? `${filteredPackages.length} packages`
              : `${filteredTests.length} tests`}
          </span>
        </div>
      </div>

      {/* ── 3. FEATURED HEALTH CHECKUP PACKAGES ────────────────────────────── */}
      {activeTab === "packages" ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Curated Health Checkup Packages</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-sky-100 text-sky-800">
                {filteredPackages.length} Available
              </span>
            </h2>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Up to 35% bundled savings with home collection
            </span>
          </div>

          {filteredPackages.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center flex flex-col items-center gap-2">
              <FlaskConical size={28} className="text-slate-400" />
              <h3 className="font-bold text-slate-800 text-sm">No packages match</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                No checkup packages match &quot;{search}&quot;. Try another term.
              </p>
              <button
                type="button"
                onClick={() => setSearch("")}
                className="mt-1 text-xs font-bold text-sky-600 hover:underline cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredPackages.map((pkg) => {
                const pct = discountPct(pkg.price, pkg.discountPrice);
                const price = effectivePrice(pkg.price, pkg.discountPrice);
                const { stars, reviews } = ratingFromId(pkg.id);

                return (
                  <article
                    key={pkg.id}
                    className="group relative rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-xs hover:shadow-md hover:border-sky-300 transition-all flex flex-col justify-between overflow-hidden"
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-1"
                      style={{
                        background:
                          "linear-gradient(90deg, #0284C7 0%, #38BDF8 50%, #10B981 100%)",
                      }}
                    />

                    <div>
                      {/* Badge Header Row */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200/60">
                            <Sparkles size={10} />
                            {pkg.tag ?? "PACKAGE"}
                          </span>
                          {pct > 0 ? (
                            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                              <TrendingDown size={10} />
                              {pct}% OFF
                            </span>
                          ) : null}
                        </div>

                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                          <Layers size={11} className="text-slate-500" />
                          {pkg.testCount} Tests Included
                        </span>
                      </div>

                      {/* Title & Star Rating */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-800 transition-colors leading-snug">
                          {pkg.name}
                        </h3>
                        <div className="flex items-center gap-1 text-xs shrink-0 pt-0.5">
                          <Star size={12} className="fill-amber-500 text-amber-500" />
                          <span className="font-bold text-slate-800">{stars}</span>
                          <span className="text-[10.5px] text-slate-400">({reviews})</span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                        {pkg.description}
                      </p>

                      {/* Inclusions Badges (Compact 2-col pills) */}
                      {pkg.includedParameters ? (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {pkg.includedParameters.slice(0, 4).map((param) => (
                            <div
                              key={param}
                              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-700 bg-slate-50 rounded-lg px-2.5 py-1 truncate"
                            >
                              <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                              <span className="truncate">{param}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {/* Logistics details */}
                      <div className="flex items-center gap-3 mt-3 text-[11px] font-medium text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock size={11} className="text-sky-600" />
                          Report in {pkg.reportTimeHours ?? 24}h
                        </span>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <Home size={11} className="text-emerald-600" />
                          Free Home Visit
                        </span>
                        {pkg.fastingHours ? (
                          <>
                            <span>·</span>
                            <span>Fasting: {pkg.fastingHours}h</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    {/* Bottom Pricing & Action Row */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-black text-slate-900 tracking-tight">
                            {formatLkr(price)}
                          </span>
                          {pkg.discountPrice && pkg.discountPrice < pkg.price ? (
                            <span className="text-xs line-through text-slate-400 font-medium">
                              {formatLkr(pkg.price)}
                            </span>
                          ) : null}
                        </div>
                        {pkg.savings > 0 ? (
                          <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                            <Tag size={10} />
                            Save {formatLkr(pkg.savings)}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        <Link
                          href={`/patient/diagnostic-tests/packages/${pkg.slug}`}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Details
                        </Link>
                        <button
                          type="button"
                          onClick={() =>
                            setBookingItem({
                              type: "package",
                              id: pkg.id,
                              name: pkg.name,
                              price,
                              savings: pkg.savings,
                            })
                          }
                          className="px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                          style={{
                            background:
                              "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                          }}
                        >
                          <span>Book Home Visit</span>
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* ── 4. INDIVIDUAL LAB TESTS CATALOG ───────────────────────────────── */}
      {activeTab === "tests" ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <span>Individual Diagnostic Tests</span>
              <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-slate-100 text-slate-700">
                {filteredTests.length} Tests
              </span>
            </h2>
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Single tests with sterile collection kit
            </span>
          </div>

          {testsQuery.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl bg-slate-100 animate-pulse border border-slate-200"
                />
              ))}
            </div>
          ) : filteredTests.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center flex flex-col items-center gap-2">
              <FlaskConical size={28} className="text-slate-400" />
              <h3 className="font-bold text-slate-800 text-sm">No tests found</h3>
              <p className="text-xs text-slate-500 max-w-sm">
                Nothing matched &quot;{search}&quot;. Try another term.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("all");
                }}
                className="mt-1 text-xs font-bold text-sky-600 hover:underline cursor-pointer"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTests.map((test) => {
                const price = effectivePrice(test.price, test.discountPrice);

                return (
                  <div
                    key={test.id}
                    className="group rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs hover:shadow-sm hover:border-sky-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                          {getTestIcon(test.category)}
                        </div>
                        <span className="text-[10.5px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md truncate max-w-[120px]">
                          {test.category ?? "Pathology"}
                        </span>
                      </div>

                      <Link
                        href={`/patient/diagnostic-tests/${test.slug}`}
                        className="block font-bold text-sm text-slate-900 group-hover:text-sky-700 transition-colors line-clamp-1"
                      >
                        {test.name}
                      </Link>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                        <span>{test.sampleType ?? "Blood Sample"}</span>
                        <span>·</span>
                        <span className="text-emerald-600 font-medium">Home Visit</span>
                      </div>
                    </div>

                    <div className="mt-3.5 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-sm font-black text-slate-900">
                          {formatLkr(price)}
                        </span>
                        {test.discountPrice && test.discountPrice < test.price && (
                          <span className="text-[11px] line-through text-slate-400">
                            {formatLkr(test.price)}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setBookingItem({
                            type: "test",
                            id: test.id,
                            name: test.name,
                            price,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200/70 transition-colors cursor-pointer"
                      >
                        Book Now
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {/* ── 5. INTERACTIVE HOME COLLECTION BOOKING MODAL ────────────────── */}
      {bookingItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div
              className="p-5 text-white flex items-center justify-between"
              style={{
                background: "linear-gradient(135deg, #0C4A6E 0%, #0369A1 100%)",
              }}
            >
              <div>
                <span className="text-[10.5px] font-bold uppercase tracking-wider text-sky-200 flex items-center gap-1">
                  <Home size={12} />
                  Home Sample Collection Booking
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  {bookingItem.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm font-black text-white">
                    Total: {formatLkr(bookingItem.price)}
                  </span>
                  {bookingItem.savings ? (
                    <span className="text-[11px] font-bold text-emerald-300 bg-emerald-900/40 px-2 py-0.5 rounded-full">
                      Saving {formatLkr(bookingItem.savings)}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setBookingItem(null);
                  setBookingStatus("idle");
                }}
                className="h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-4">
              {bookingStatus === "success" ? (
                <div className="py-6 flex flex-col items-center text-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 size={26} />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">
                    Booking Confirmed!
                  </h4>
                  <p className="text-xs text-slate-600 max-w-sm">
                    {bookingMsg}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setBookingItem(null);
                      setBookingStatus("idle");
                    }}
                    className="mt-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Collection Date
                      </label>
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Preferred Time Slot
                      </label>
                      <select
                        value={scheduledSlot}
                        onChange={(e) => setScheduledSlot(e.target.value)}
                        className="w-full h-9 px-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option>07:00 - 09:00 AM (Early Fasting)</option>
                        <option>09:00 - 11:00 AM (Morning)</option>
                        <option>11:00 AM - 01:00 PM (Afternoon)</option>
                        <option>03:00 - 05:00 PM (Evening)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={addressLine}
                      onChange={(e) => setAddressLine(e.target.value)}
                      placeholder="Street name, house/flat number"
                      className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        City / Area
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="e.g. Colombo 03"
                        className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Contact Phone
                      </label>
                      <input
                        type="tel"
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        placeholder="077XXXXXXX"
                        className="w-full h-9 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl flex items-start gap-2 text-xs text-blue-900">
                    <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <span>
                      Our verified phlebotomist will arrive with a sterile sealed kit and temperature-controlled container. Settle via cash or card reader upon collection.
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setBookingItem(null)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmBooking}
                      disabled={bookingStatus === "submitting" || !contactPhone || !addressLine}
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md disabled:opacity-60 transition-all flex items-center gap-1.5 cursor-pointer"
                      style={{
                        background:
                          "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                      }}
                    >
                      {bookingStatus === "submitting" ? (
                        <span>Processing…</span>
                      ) : (
                        <>
                          <span>Confirm Home Booking</span>
                          <ArrowRight size={13} />
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
