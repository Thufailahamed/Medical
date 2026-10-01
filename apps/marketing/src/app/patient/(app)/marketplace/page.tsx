"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  HeartHandshake,
  Inbox,
  Languages,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";

import {
  Badge,
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HERO_ATTENTION_CHIP,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelError,
  PanelHeader,
  PanelSearch,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";
import {
  useCaretakerInquiries,
  useMarketplace,
} from "@/patient/hooks/marketplace";
import { humanize } from "@/patient/lib/format";

const DISTRICTS = [
  "Colombo",
  "Kandy",
  "Galle",
  "Jaffna",
  "Gampaha",
  "Matara",
  "Kurunegala",
];

const ROLES = ["nurse", "caregiver", "home_aide", "companion"];

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "si", label: "Sinhala" },
  { value: "ta", label: "Tamil" },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("");
  const [role, setRole] = useState("");
  const [language, setLanguage] = useState("");

  const query = useMarketplace({
    district: district || undefined,
    role: role || undefined,
    language: language || undefined,
  });
  const inquiries = useCaretakerInquiries();

  const caretakers = useMemo(() => {
    const list = query.data?.caretakers ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((c) =>
      [c.name, c.district, c.bio]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(needle)),
    );
  }, [query.data, search]);

  const all = query.data?.caretakers ?? [];
  const verifiedCount = all.filter((c) => c.verified).length;
  const districtCount = new Set(all.map((c) => c.district).filter(Boolean)).size;
  const inquiryCount = inquiries.data?.inquiries.length ?? 0;
  const pendingCount =
    inquiries.data?.inquiries.filter((i) => i.status === "pending").length ?? 0;

  return (
    <PatientPage>
      <PatientHero
        kickerIcon={<HeartHandshake size={13} aria-hidden />}
        kicker="Family & Safety"
        kickerMeta="Care at home"
        title={
          <>
            Caretaker <HeroAccent>marketplace</HeroAccent>
          </>
        }
        description="Browse verified caretakers, nurses, and home aides offering home visits across Sri Lanka — send an inquiry to connect."
        chips={
          <>
            <span className={HERO_CHIP}>
              <UserCheck size={12} className="text-emerald-300" aria-hidden />
              {all.length} available
            </span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-sky-300" aria-hidden />
              Identity-verified only
            </span>
            {pendingCount > 0 ? (
              <Link href="/patient/marketplace/inquiries" className={HERO_ATTENTION_CHIP}>
                <Inbox size={12} aria-hidden />
                {pendingCount} pending inquir{pendingCount === 1 ? "y" : "ies"}
              </Link>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/patient/caretakers" className={HERO_GHOST}>
              <Users size={13} aria-hidden /> My caretakers
            </Link>
            <Link href="/patient/marketplace/inquiries" className={HERO_PRIMARY}>
              <Inbox size={14} className="text-sky-600" aria-hidden /> My inquiries
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<UserCheck size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Available now"
          value={String(all.length)}
          sub="Accepting new patients"
        />
        <StatTile
          icon={<BadgeCheck size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Verified"
          value={String(verifiedCount)}
          sub="Identity checks cleared"
        />
        <StatTile
          icon={<MapPin size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Districts"
          value={String(districtCount)}
          sub="Coverage across the island"
        />
        <StatTile
          icon={<Inbox size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="My inquiries"
          value={String(inquiryCount)}
          sub={pendingCount > 0 ? `${pendingCount} awaiting reply` : "None pending"}
          pulse={pendingCount > 0}
          href="/patient/marketplace/inquiries"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <section className={PANEL} aria-labelledby="mk-filters">
            <PanelHeader
              id="mk-filters"
              icon={<SlidersHorizontal size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Find your caretaker"
              caption="Filter by district, care role, or language — every listing is identity-verified."
            />
            <div className="mt-5 flex flex-col gap-4">
              <PanelSearch
                value={search}
                onChange={setSearch}
                placeholder="Search by name, district, or keyword…"
                ariaLabel="Search caretakers"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mk-district" className={FIELD_LABEL}>
                    District
                  </label>
                  <select
                    id="mk-district"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    <option value="">All districts</option>
                    {DISTRICTS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mk-role" className={FIELD_LABEL}>
                    Care role
                  </label>
                  <select
                    id="mk-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    <option value="">All roles</option>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {humanize(r)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="mk-language" className={FIELD_LABEL}>
                    Language
                  </label>
                  <select
                    id="mk-language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className={FIELD_INPUT}
                  >
                    <option value="">Any language</option>
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </section>

          <section className={PANEL} aria-labelledby="mk-results">
            <PanelHeader
              id="mk-results"
              icon={<HeartHandshake size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title={`Caretakers (${caretakers.length})`}
              caption="Verified providers who are open to new inquiries."
            />
            {query.isLoading ? (
              <PanelSkeleton rows={3} />
            ) : query.isError ? (
              <PanelError onRetry={() => void query.refetch()} />
            ) : caretakers.length === 0 ? (
              <EmptyBlock
                icon={<HeartHandshake size={19} />}
                title="No caretakers match your filters"
                body="Try widening the district or role filters — new verified caretakers join regularly."
              />
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {caretakers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/patient/marketplace/${c.id}`}
                    className="group flex flex-col justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-slate-200 hover:shadow-[0_10px_28px_-14px_rgba(15,23,42,0.25)]"
                  >
                    <div className="flex items-start gap-3">
                      {c.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={c.photo}
                          alt={`${c.name} portrait`}
                          className="h-12 w-12 shrink-0 rounded-xl object-cover"
                        />
                      ) : (
                        <div
                          className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-50 text-sm font-bold text-sky-600"
                          aria-hidden
                        >
                          {getInitials(c.name ?? "?")}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="truncate text-sm font-bold text-slate-900 transition-colors group-hover:text-sky-700">
                            {c.name}
                          </h3>
                          {c.verified ? (
                            <BadgeCheck
                              size={14}
                              className="shrink-0 text-emerald-500"
                              aria-label="Verified"
                            />
                          ) : null}
                        </div>
                        <p className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs font-medium text-slate-500">
                          {c.district ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={11} aria-hidden /> {c.district}
                            </span>
                          ) : null}
                          {c.experienceYears > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Briefcase size={11} aria-hidden />
                              {c.experienceYears} yrs
                            </span>
                          ) : null}
                          {c.languages.length > 0 ? (
                            <span className="inline-flex items-center gap-1">
                              <Languages size={11} aria-hidden />
                              {c.languages.map((l) => l.toUpperCase()).join(" · ")}
                            </span>
                          ) : null}
                        </p>
                        {c.careRolesOffered.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {c.careRolesOffered.slice(0, 3).map((r) => (
                              <Badge key={r} tone="sky">
                                {humanize(r)}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {c.bio ? (
                      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {c.bio}
                      </p>
                    ) : null}

                    <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      {c.hourlyRateLkr ? (
                        <p className="text-sm font-extrabold text-slate-900">
                          LKR {c.hourlyRateLkr.toLocaleString()}
                          <span className="ml-1 text-[11px] font-medium text-slate-400">
                            /hour
                          </span>
                        </p>
                      ) : (
                        <p className="text-xs font-medium text-slate-400">
                          Rate on request
                        </p>
                      )}
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-sky-700">
                        View profile
                        <ArrowRight
                          size={13}
                          className="transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="mk-tools"
            title="Family & Safety"
            tools={[
              {
                icon: Users,
                label: "Caretakers",
                hint: "Shared access",
                href: "/patient/caretakers",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Users,
                label: "Family",
                hint: "Members",
                href: "/patient/family",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
              {
                icon: ShieldAlert,
                label: "Emergency",
                hint: "SOS + med ID",
                href: "/patient/emergency",
                tone: "from-rose-500 to-red-600 shadow-rose-500/30",
              },
            ]}
          />

          <PromoCard
            icon={<ShieldCheck size={21} aria-hidden />}
            kicker="Already have help?"
            title="Authorize a caretaker"
            body="Link a trusted family member or nurse for delegated access instead."
            href="/patient/caretakers"
          />
        </div>
      </div>
    </PatientPage>
  );
}
