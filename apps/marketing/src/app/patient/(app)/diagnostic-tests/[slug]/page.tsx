"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  Clock3,
  FlaskConical,
  Home,
  MapPin,
  Phone,
  Wallet,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HeroAccent,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
} from "@/patient/components/workspace";

type LabOffer = { labId: string; labName: string; price: number; discountPrice: number | null };
type Detail = { id: string; name: string; description: string | null; price: number; discountPrice: number | null; minPrice?: number | null; sampleType: string | null; fastingRequired: boolean; availableAt?: LabOffer[]; laboratoryCount?: number };

export default function DiagnosticTestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const query = useQuery({
    queryKey: ["patient", "diagnostic-tests", "detail", slug],
    queryFn: () => api<Detail>(`/diagnostic-tests/${encodeURIComponent(slug)}`),
  });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [labId, setLabId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function book(test: Detail, explicitLabId?: string | null) {
    if (!date || !time || !addressLine1 || !city || !district || !contactPhone) return;
    setError(null);
    setStatus(null);
    const chosen = explicitLabId ?? labId;
    try {
      await api("/diagnostic-tests/book", { method: "POST", json: { bookingType: "single_test", testId: test.id, ...(chosen ? { labPartnerId: chosen } : {}), scheduledDate: date, scheduledTimeSlot: time, collectionAddress: { line1: addressLine1, city, district, contactPhone }, paymentMethod: "cash" } });
      setStatus("Test booking requested.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not book this test.");
    }
  }

  const test = query.data;

  if (!test) {
    return (
      <PatientPage>
        <PatientHero
          overlap={false}
          kickerIcon={<FlaskConical size={13} aria-hidden />}
          kicker="Lab tests"
          title={query.isLoading ? "Loading test…" : "Test not found"}
          description={
            query.isLoading
              ? "Fetching the test details and lab options."
              : "This diagnostic test is no longer available."
          }
          actions={
            <Link href="/patient/diagnostic-tests" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              All tests
            </Link>
          }
        />
        <section className={PANEL}>
          {query.isLoading ? (
            <PanelSkeleton rows={3} className="mt-0" />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : (
            <EmptyBlock
              className="mt-0"
              icon={<FlaskConical size={19} />}
              title="Test not found"
              body="This diagnostic test is no longer available in the catalogue."
            />
          )}
        </section>
      </PatientPage>
    );
  }

  const offers = test.availableAt ?? [];
  const price = test.minPrice ?? test.discountPrice ?? test.price;
  const effectiveLab = labId ?? offers.slice().sort((a, b) => (a.discountPrice ?? a.price) - (b.discountPrice ?? b.price))[0]?.labId ?? null;
  const canBook = Boolean(date && time && addressLine1 && city && district && contactPhone);

  return (
    <PatientPage>
      <PatientHero
        overlap={false}
        kickerIcon={<FlaskConical size={13} aria-hidden />}
        kicker="Lab tests"
        kickerMeta={test.sampleType ?? "Home collection"}
        title={
          <>
            {test.name.split(" ").slice(0, -1).join(" ")}{" "}
            <HeroAccent>{test.name.split(" ").slice(-1)[0]}</HeroAccent>
          </>
        }
        description={test.description ?? "Review preparation requirements and request home collection."}
        chips={
          <>
            <span className={HERO_CHIP}>
              <Wallet size={12} className="text-emerald-300" aria-hidden />
              LKR {price.toLocaleString()}
            </span>
            {test.fastingRequired ? (
              <span className={HERO_CHIP}>
                <Clock3 size={12} className="text-amber-300" aria-hidden />
                Fasting required
              </span>
            ) : null}
            {typeof test.laboratoryCount === "number" ? (
              <span className={HERO_CHIP}>
                <FlaskConical size={12} className="text-sky-300" aria-hidden />
                {test.laboratoryCount} lab{test.laboratoryCount === 1 ? "" : "s"}
              </span>
            ) : null}
          </>
        }
        actions={
          <Link href="/patient/diagnostic-tests" className={HERO_GHOST}>
            <ChevronLeft size={15} aria-hidden />
            All tests
          </Link>
        }
      />

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="dt-book">
          <PanelHeader
            id="dt-book"
            icon={<Home size={16} />}
            tone="bg-teal-50 text-teal-600"
            title="Book home collection"
            caption="Pick a lab, choose a slot, share your address"
          />

          {offers.length > 0 ? (
            <fieldset className="mt-5">
              <legend className={GROUP_LABEL}>Choose a laboratory</legend>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {offers.map((o) => {
                  const selected = (labId ?? effectiveLab) === o.labId;
                  return (
                    <label
                      key={o.labId}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl p-3.5 transition-all",
                        selected
                          ? "bg-sky-50 shadow-[inset_0_0_0_1.5px_#0284c7]"
                          : "bg-slate-50 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] hover:bg-white",
                      )}
                    >
                      <input
                        type="radio"
                        name="lab"
                        checked={selected}
                        onChange={() => setLabId(o.labId)}
                        className="h-4 w-4 accent-sky-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-900">
                          {o.labName || o.labId}
                        </span>
                        <span className="block text-xs text-slate-500">
                          LKR {(o.discountPrice ?? o.price).toLocaleString()}
                          {o.discountPrice != null ? (
                            <span className="ml-1.5 text-slate-400 line-through">LKR {o.price.toLocaleString()}</span>
                          ) : null}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={FIELD_LABEL}>
                <CalendarDays size={12} className="mr-1 inline" aria-hidden />
                Preferred date
              </span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD_INPUT} />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>
                <Clock3 size={12} className="mr-1 inline" aria-hidden />
                Time slot
              </span>
              <input type="text" value={time} onChange={(e) => setTime(e.target.value)} placeholder="e.g. morning" className={FIELD_INPUT} />
            </label>
            <label className="block sm:col-span-2">
              <span className={FIELD_LABEL}>
                <MapPin size={12} className="mr-1 inline" aria-hidden />
                Collection address
              </span>
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={FIELD_INPUT} />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>City</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} className={FIELD_INPUT} />
            </label>
            <label className="block">
              <span className={FIELD_LABEL}>District</span>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className={FIELD_INPUT} />
            </label>
            <label className="block sm:col-span-2">
              <span className={FIELD_LABEL}>
                <Phone size={12} className="mr-1 inline" aria-hidden />
                Contact phone
              </span>
              <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={FIELD_INPUT} />
            </label>
          </div>

          {error ? <p role="alert" className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
          {status ? <p role="status" className="mt-4 text-sm font-semibold text-emerald-600">{status}</p> : null}

          <button
            type="button"
            onClick={() => book(test, effectiveLab)}
            disabled={!canBook}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-[#07233a] px-5 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:opacity-50"
          >
            <Home size={15} aria-hidden />
            Book home collection · LKR {price.toLocaleString()}
          </button>
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Booking help">
          <section className={PANEL} aria-labelledby="dt-steps">
            <PanelHeader
              id="dt-steps"
              icon={<FlaskConical size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="How it works"
              caption="Three steps to your report"
            />
            <ol className="mt-4 flex flex-col gap-3">
              {[
                "Pick a slot — a phlebotomist visits your address.",
                "The lab processes your sample and uploads the result.",
                "View the report here or in your medical records.",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-sky-50 text-[11px] font-bold text-sky-700">
                    {i + 1}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-600">{step}</span>
                </li>
              ))}
            </ol>
          </section>

          <QuickToolsPanel
            id="dt-tools"
            tools={[
              { href: "/patient/diagnostic-tests/packages", label: "Packages", hint: "Bundled deals", icon: FlaskConical, tone: "from-teal-500 to-emerald-600 shadow-teal-500/30" },
              { href: "/patient/diagnostic-tests/bookings", label: "Bookings", hint: "Track orders", icon: CalendarDays, tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
            ]}
          />

          <PromoCard
            href="/patient/diagnostic-tests/packages"
            kicker="Save more"
            icon={<FlaskConical size={21} aria-hidden />}
            title="Bundle tests in a package"
            body="Accredited lab bundles at one discounted price"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
