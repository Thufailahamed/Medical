"use client";

import { useState, useMemo } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  UserCheck,
  Eye,
  Mail,
  Calendar,
  Clock,
  MapPin,
  Building2,
  Stethoscope,
  FlaskConical,
  Hospital,
  Pill as PillIcon,
  Truck,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  User,
  Info,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  ROW_LINK,
  RowAccent,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  ROW_BTN_APPROVE,
  ROW_BTN_DANGER,
  humanize,
  statusRail,
  statusTone,
} from "@/portal/components/admin/AdminDirectory";import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { BulkActionBar } from "@/portal/components/admin/BulkActionBar";
import { ExportButton } from "@/portal/components/admin/ExportButton";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

const STATUS_FILTERS = [
  { key: "pending", label: "Pending Review" },
  { key: "active", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "suspended", label: "Suspended" },
] as const;

type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

type Item = {
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    status: string;
    createdAt: string;
    rejectionReason?: string | null;
  };
  doctorProfile?: {
    specialization?: string | null;
    slmcRegistrationNo?: string | null;
    registrationNumber?: string | null;
    yearsExperience?: number | null;
  } | null;
  labProfile?: {
    userId?: string;
    labName?: string;
    licenseNumber?: string;
    accreditation?: string | null;
    address?: string;
    city?: string | null;
    operatingHours?: string | null;
    bankName?: string | null;
    bankAccount?: string | null;
    createdAt?: string;
  } | null;
};

const ROLE_CONFIG: Record<
  string,
  {
    label: string;
    icon: typeof User;
    tone: "brand" | "success" | "warn" | "info" | "danger" | "neutral" | "accent" | "violet";
    bgLight: string;
    textDark: string;
  }
> = {
  doctor: {
    label: "Doctor",
    icon: Stethoscope,
    tone: "info",
    bgLight: "bg-sky-50",
    textDark: "text-sky-700",
  },
  laboratory: {
    label: "Laboratory",
    icon: FlaskConical,
    tone: "warn",
    bgLight: "bg-blue-50",
    textDark: "text-blue-700",
  },
  hospital_admin: {
    label: "Hospital Admin",
    icon: Hospital,
    tone: "accent",
    bgLight: "bg-purple-50",
    textDark: "text-purple-700",
  },
  pharmacy: {
    label: "Pharmacy",
    icon: PillIcon,
    tone: "violet",
    bgLight: "bg-indigo-50",
    textDark: "text-indigo-700",
  },
  insurance: {
    label: "Insurance",
    icon: ShieldCheck,
    tone: "neutral",
    bgLight: "bg-slate-100",
    textDark: "text-slate-700",
  },
  ambulance: {
    label: "Ambulance",
    icon: Truck,
    tone: "danger",
    bgLight: "bg-rose-50",
    textDark: "text-rose-700",
  },
};

const COMMON_REJECTION_REASONS = [
  "SLMC registration number could not be verified with official registry",
  "Laboratory license number invalid or expired",
  "Missing required council accreditation certificate",
  "Incomplete facility address or invalid contact details",
  "Duplicate registration application",
];

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<StatusKey>("pending");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [rejectTarget, setRejectTarget] = useState<Item | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewTarget, setReviewTarget] = useState<Item | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifiedChecks, setVerifiedChecks] = useState<Record<string, boolean>>({});

  // Active status query
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: adminQk.approvals(status),
    queryFn: () => adminApi<{ items: Item[]; total: number }>(`/admin/approvals?status=${status}`),
  });

  // Pending count for top badges
  const { data: pendingData } = useQuery({
    queryKey: adminQk.approvals("pending"),
    queryFn: () => adminApi<{ items: Item[]; total: number }>(`/admin/approvals?status=pending`),
    enabled: status !== "pending",
  });

  const pendingCount = status === "pending" ? data?.items?.length ?? 0 : pendingData?.items?.length ?? 0;

  // Counts for the other buckets so the stat strip shows real numbers.
  const bucketQueries = useQueries({
    queries: (["active", "rejected", "suspended"] as const).map((k) => ({
      queryKey: adminQk.approvals(k),
      queryFn: () => adminApi<{ items: Item[]; total: number }>(`/admin/approvals?status=${k}`),
      staleTime: 60_000,
    })),
  });
  const statusCounts: Record<StatusKey, number | undefined> = {
    pending: pendingCount,
    active: bucketQueries[0].data?.items?.length,
    rejected: bucketQueries[1].data?.items?.length,
    suspended: bucketQueries[2].data?.items?.length,
  };

  const approve = useMutation({
    mutationFn: (userId: string) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/approve`, { method: "POST", json: {} }),
    onSuccess: () => {
      toast.success("Account approved successfully");
      setReviewTarget(null);
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: unknown) => toast.error("Could not approve", e instanceof Error ? e.message : undefined),
  });

  const reject = useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      adminApiWithStepUp(`/admin/approvals/${userId}/reject`, { method: "POST", json: { reason } }),
    onSuccess: () => {
      toast.success("Application rejected");
      setRejectTarget(null);
      setReviewTarget(null);
      setRejectReason("");
      qc.invalidateQueries({ queryKey: ["admin", "approvals"] });
    },
    onError: (e: unknown) => toast.error("Could not reject", e instanceof Error ? e.message : undefined),
  });

  function copyToClipboard(text?: string | null, id: string = "") {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Filter items by search query and role filter
  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    let items = data.items;

    if (roleFilter !== "all") {
      items = items.filter((it) => it.user.role === roleFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter((it) => {
        const u = it.user;
        const doc = it.doctorProfile;
        const lab = it.labProfile;
        return (
          u.name.toLowerCase().includes(q) ||
          (u.email && u.email.toLowerCase().includes(q)) ||
          (u.phone && u.phone.toLowerCase().includes(q)) ||
          u.role.toLowerCase().includes(q) ||
          (doc?.specialization && doc.specialization.toLowerCase().includes(q)) ||
          (doc?.slmcRegistrationNo && doc.slmcRegistrationNo.toLowerCase().includes(q)) ||
          (lab?.labName && lab.labName.toLowerCase().includes(q)) ||
          (lab?.licenseNumber && lab.licenseNumber.toLowerCase().includes(q)) ||
          (lab?.city && lab.city.toLowerCase().includes(q))
        );
      });
    }

    return items;
  }, [data?.items, roleFilter, searchQuery]);

  const allChecked = filteredItems.length > 0 && filteredItems.every((it) => selected.has(it.user.id));
  const roleBreakdown = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of data?.items ?? []) m.set(it.user.role, (m.get(it.user.role) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [data?.items]);
  const oldestPending = useMemo(() => {
    const list = status === "pending" ? data?.items : pendingData?.items;
    if (!list?.length) return null;
    return list.reduce((m, it) => (it.user.createdAt < m ? it.user.createdAt : m), list[0].user.createdAt);
  }, [status, data?.items, pendingData?.items]);
  const [now] = useState(() => Date.now());
  const oldestDays = oldestPending ? Math.floor((now - Date.parse(oldestPending)) / 86_400_000) : null;
  const countFor = (k: StatusKey) => (k === status ? data?.items?.length : statusCounts[k]);
  const pickStatus = (k: StatusKey) => {
    setStatus(k);
    setSelected(new Set());
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<UserCheck size={13} aria-hidden />}
          kicker="Provider onboarding"
          kickerMeta={`${pendingCount} in queue`}
          title={
            <>
              Account{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                approvals
              </span>
            </>
          }
          description={
            pendingCount > 0
              ? `${pendingCount} application${pendingCount === 1 ? "" : "s"} waiting. Verify credentials before granting portal access.`
              : "The review queue is clear. New doctor, lab, hospital and pharmacy sign-ups land here."
          }
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Step-up auth on every decision
              </span>
              {oldestDays != null && oldestDays > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <Clock size={12} aria-hidden />
                  Oldest waiting {oldestDays}d
                </span>
              ) : null}
            </>
          }
          actions={
            <>
              <button type="button" onClick={() => refetch()} disabled={isFetching} className={HERO_GHOST}>
                <RefreshCw size={15} className={isFetching ? "animate-spin" : undefined} aria-hidden />
                {isFetching ? "Refreshing…" : "Refresh"}
              </button>
              <div className="[&_button]:h-10 [&_button]:rounded-[10px]">
                <ExportButton exportPath="approvals" filters={{ status }} />
              </div>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Pending review"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(pendingCount)}
            sub={pendingCount ? "Needs a decision" : "Queue is clear"}
            pulse={pendingCount > 0}
            badge={pendingCount ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={status === "pending"}
            onClick={() => pickStatus("pending")}
          />
          <StatTile
            label="Approved"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={countFor("active") != null ? String(countFor("active")) : "…"}
            sub="Live provider accounts"
            active={status === "active"}
            onClick={() => pickStatus("active")}
          />
          <StatTile
            label="Rejected"
            icon={<XCircle size={16} />}
            tone="bg-red-50 text-red-600"
            value={countFor("rejected") != null ? String(countFor("rejected")) : "…"}
            sub="Declined applications"
            active={status === "rejected"}
            onClick={() => pickStatus("rejected")}
          />
          <StatTile
            label="Suspended"
            icon={<AlertCircle size={16} />}
            tone="bg-slate-100 text-slate-600"
            value={countFor("suspended") != null ? String(countFor("suspended")) : "…"}
            sub="Access on hold"
            active={status === "suspended"}
            onClick={() => pickStatus("suspended")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Applications ─────────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="apr-list">
          <PanelHeader
            id="apr-list"
            icon={<UserCheck size={16} />}
            tone="bg-amber-50 text-amber-600"
            title={STATUS_FILTERS.find((f) => f.key === status)?.label ?? "Applications"}
            caption={
              isLoading
                ? "Loading applications…"
                : `${filteredItems.length} of ${data?.items?.length ?? 0} shown${selected.size ? ` · ${selected.size} selected` : ""}`
            }
          />

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PanelSearch
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search name, email, phone, licence…"
              ariaLabel="Search applications"
              className="lg:max-w-[260px]"
            />
            <Segmented<StatusKey>
              ariaLabel="Status"
              value={status}
              onChange={pickStatus}
              options={STATUS_FILTERS.map((f) => ({
                value: f.key,
                label: f.key === "pending" ? "Pending" : f.label,
                count: countFor(f.key) ?? undefined,
              }))}
            />
          </div>

          {isLoading ? (
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-[76px] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyBlock
              icon={<UserCheck size={19} />}
              title={searchQuery || roleFilter !== "all" ? "No matching applications" : `No ${status === "active" ? "approved" : status} applications`}
              body={
                searchQuery || roleFilter !== "all"
                  ? "Try another search term or clear the role filter."
                  : status === "pending"
                    ? "Every application has been reviewed. New sign-ups will appear here."
                    : "Nothing in this bucket right now."
              }
              actions={
                searchQuery || roleFilter !== "all" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setRoleFilter("all");
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700"
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <>
              <label className="mt-4 flex cursor-pointer items-center gap-2.5 px-1 text-xs font-medium text-slate-500">
                <input
                  type="checkbox"
                  aria-label="Select all applications"
                  checked={allChecked}
                  onChange={(e) =>
                    setSelected(e.target.checked ? new Set(filteredItems.map((it) => it.user.id)) : new Set())
                  }
                  className="h-4 w-4 accent-sky-600"
                />
                Select all
              </label>
              <ul className="mt-2 flex flex-col gap-2">
                {filteredItems.map((it) => {
                  const u = it.user;
                  const isChecked = selected.has(u.id);
                  const roleConfig = ROLE_CONFIG[u.role] ?? {
                    label: humanize(u.role),
                    icon: User,
                    tone: "neutral" as const,
                    bgLight: "bg-slate-50",
                    textDark: "text-slate-700",
                  };
                  const RoleIcon = roleConfig.icon;
                  const waitingDays = Math.floor((now - Date.parse(u.createdAt)) / 86_400_000);
                  const canDecide = u.status === "pending" || u.status === "suspended";

                  return (
                    <li
                      key={u.id}
                      className={cn(LIST_ROW, isChecked && "bg-sky-50/60 shadow-[inset_0_0_0_1.5px_rgba(2,132,199,0.35)]")}
                    >
                      <RowAccent className={statusRail(u.status)} />
                      <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                        <input
                          type="checkbox"
                          aria-label={`Select ${u.name}`}
                          checked={isChecked}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(u.id);
                            else next.delete(u.id);
                            setSelected(next);
                          }}
                          className="h-4 w-4 shrink-0 accent-sky-600"
                        />
                        <button
                          type="button"
                          onClick={() => setReviewTarget(it)}
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
                        >
                          <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-[10px]", roleConfig.bgLight, roleConfig.textDark)}>
                            <RoleIcon size={17} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                                {u.name}
                              </span>
                              <Pill tone={roleConfig.tone}>{roleConfig.label}</Pill>
                              {u.status !== "pending" ? <Pill tone={statusTone(u.status)}>{u.status === "active" ? "Approved" : humanize(u.status)}</Pill> : null}
                              {u.status === "pending" && waitingDays >= 3 ? (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
                                  {waitingDays}d waiting
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              {it.doctorProfile ? (
                                <>
                                  <span className="inline-flex items-center gap-1">
                                    <Stethoscope size={11} />
                                    {it.doctorProfile.specialization || "General practitioner"}
                                  </span>
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                    SLMC {it.doctorProfile.slmcRegistrationNo || "pending"}
                                  </span>
                                </>
                              ) : it.labProfile ? (
                                <>
                                  <span className="inline-flex items-center gap-1 font-mono text-[11px]">
                                    LIC {it.labProfile.licenseNumber}
                                  </span>
                                  {it.labProfile.city ? (
                                    <span className="inline-flex items-center gap-1">
                                      <MapPin size={11} />
                                      {it.labProfile.city}
                                    </span>
                                  ) : null}
                                </>
                              ) : null}
                              {u.email ? (
                                <span className="hidden min-w-0 items-center gap-1 truncate sm:inline-flex">
                                  <Mail size={11} />
                                  {u.email}
                                </span>
                              ) : null}
                              <span className="hidden items-center gap-1 sm:inline-flex">
                                <Calendar size={11} />
                                {new Date(u.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </span>
                            {u.rejectionReason ? (
                              <span className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                                <AlertCircle size={11} className="shrink-0" />
                                {u.rejectionReason}
                              </span>
                            ) : null}
                          </span>
                        </button>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                        {canDecide ? (
                          <>
                            <button
                              type="button"
                              onClick={() => approve.mutate(u.id)}
                              disabled={approve.isPending}
                              className={ROW_BTN_APPROVE}
                            >
                              <CheckCircle2 size={13} />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRejectTarget(it);
                                setRejectReason("");
                              }}
                              disabled={reject.isPending}
                              className={ROW_BTN_DANGER}
                            >
                              <XCircle size={13} />
                              Reject
                            </button>
                          </>
                        ) : null}
                        <button type="button" onClick={() => setReviewTarget(it)} className={ROW_LINK}>
                          <Eye size={13} />
                          Review
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {/* ── Role breakdown / filter ──────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Applicant types">
          <section className={PANEL} aria-labelledby="apr-roles">
            <PanelHeader
              id="apr-roles"
              icon={<Building2 size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="By applicant type"
              caption="Filter this bucket"
            />
            <ul className="mt-4 flex flex-col gap-0.5">
              {[["all", data?.items?.length ?? 0] as [string, number], ...roleBreakdown].map(([r, count]) => {
                const on = roleFilter === r;
                const cfg = ROLE_CONFIG[r];
                const Icon = r === "all" ? UserCheck : cfg?.icon ?? User;
                return (
                  <li key={r}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setRoleFilter(r)}
                      className={cn(
                        "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                        on ? "bg-sky-50" : "hover:bg-slate-50",
                      )}
                    >
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", r === "all" ? "bg-slate-100 text-slate-600" : cn(cfg?.bgLight ?? "bg-slate-50", cfg?.textDark ?? "text-slate-600"))}>
                        <Icon size={14} />
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate text-[13px]", on ? "font-semibold text-sky-800" : "font-medium text-slate-700")}>
                        {r === "all" ? "All types" : cfg?.label ?? humanize(r)}
                      </span>
                      <span className={cn("min-w-[28px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums", on ? "bg-white text-sky-700" : "bg-slate-100 text-slate-600")}>
                        {count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className={PANEL} aria-labelledby="apr-checklist">
            <PanelHeader
              id="apr-checklist"
              icon={<Info size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Review checklist"
              caption="Before you approve"
            />
            <ul className="mt-4 flex flex-col gap-2.5 text-[13px] text-slate-600">
              {[
                "Doctors: SLMC number matches the council registry",
                "Labs & pharmacies: licence is valid and unexpired",
                "Hospitals: facility address and contact are real",
                "No duplicate account for the same person or entity",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-500" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>

      {/* ─── Bulk Action Bar ─────────────────────────────────── */}
      <BulkActionBar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        invalidateKeys={[adminQk.approvals(status)]}
      />

      {/* ─── Detailed Application Inspection Modal ───────────── */}
      <Modal
        open={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget ? `Application: ${reviewTarget.user.name}` : "Application Details"}
        size="lg"
      >
        {reviewTarget && (
          <div className="flex flex-col gap-5 max-h-[75vh] overflow-y-auto pr-1">
            {/* Applicant Summary Banner */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3.5">
              <div className="h-12 w-12 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-lg shrink-0">
                {reviewTarget.user.name.slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">{reviewTarget.user.name}</h3>
                  <Pill tone={ROLE_CONFIG[reviewTarget.user.role]?.tone ?? "neutral"}>
                    {reviewTarget.user.role.replace("_", " ")}
                  </Pill>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                      reviewTarget.user.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : reviewTarget.user.status === "pending"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {reviewTarget.user.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                  <span>Applied on {new Date(reviewTarget.user.createdAt).toLocaleString()}</span>
                  <span className="font-mono text-[10px] text-slate-400">ID: {reviewTarget.user.id}</span>
                </p>
              </div>
            </div>

            {/* Contact & Profile Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Email Address
                </span>
                <p className="text-slate-900 font-medium break-all">
                  {reviewTarget.user.email || "Not provided"}
                </p>
              </div>

              <div className="p-3.5 bg-white border border-slate-200 rounded-xl space-y-1">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px] block">
                  Phone Number
                </span>
                <p className="text-slate-900 font-medium">
                  {reviewTarget.user.phone || "Not provided"}
                </p>
              </div>
            </div>

            {/* Role-Specific Credential Details */}
            {reviewTarget.doctorProfile ? (
              <div className="border border-sky-200 bg-sky-50/40 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 text-sky-800 font-bold text-sm">
                  <Stethoscope size={16} /> Medical Practitioner Credentials
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Specialization:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {reviewTarget.doctorProfile.specialization || "General Medicine"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">SLMC Registration:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-sm bg-white px-2.5 py-0.5 rounded border border-sky-300 text-sky-900">
                        {reviewTarget.doctorProfile.slmcRegistrationNo || "Pending"}
                      </span>
                      {reviewTarget.doctorProfile.slmcRegistrationNo && (
                        <button
                          type="button"
                          onClick={() =>
                            copyToClipboard(
                              reviewTarget.doctorProfile!.slmcRegistrationNo!,
                              "slmc"
                            )
                          }
                          className="text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="Copy SLMC number"
                        >
                          {copiedId === "slmc" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : reviewTarget.labProfile ? (
              <div className="border border-blue-200 bg-blue-50/40 rounded-2xl p-4.5 space-y-3">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                  <FlaskConical size={16} /> Laboratory &amp; Facility Profile
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-500 block text-[11px]">Facility Name:</span>
                    <span className="font-bold text-slate-900 text-sm">
                      {reviewTarget.labProfile.labName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[11px]">Government / MoH License:</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-mono font-bold text-sm bg-white px-2.5 py-0.5 rounded border border-blue-300 text-blue-900">
                        {reviewTarget.labProfile.licenseNumber}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          copyToClipboard(reviewTarget.labProfile!.licenseNumber, "lic")
                        }
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Copy license number"
                      >
                        {copiedId === "lic" ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-slate-500 block text-[11px]">Address &amp; Location:</span>
                    <span className="font-medium text-slate-800">
                      {reviewTarget.labProfile.address}
                      {reviewTarget.labProfile.city ? `, ${reviewTarget.labProfile.city}` : ""}
                    </span>
                  </div>
                  {reviewTarget.labProfile.accreditation && (
                    <div>
                      <span className="text-slate-500 block text-[11px]">Accreditation:</span>
                      <span className="font-medium text-slate-800">
                        {reviewTarget.labProfile.accreditation}
                      </span>
                    </div>
                  )}
                  {reviewTarget.labProfile.operatingHours && (
                    <div>
                      <span className="text-slate-500 block text-[11px]">Operating Hours:</span>
                      <span className="font-medium text-slate-800">
                        {reviewTarget.labProfile.operatingHours}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-slate-200 bg-slate-50/70 rounded-2xl p-4 flex items-start gap-3">
                <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                <div className="text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-800">
                    Standard Registration Profile
                  </p>
                  <p>
                    No extended institutional profile (SLMC or Laboratory License) has been submitted for this account yet. The applicant completed account registration with their email and phone number.
                  </p>
                </div>
              </div>
            )}

            {/* Verification Checklist */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                Verification Checklist (Admin Audit)
              </span>
              <div className="space-y-1.5 text-xs text-slate-700">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!verifiedChecks[`${reviewTarget.user.id}-lic`]}
                    onChange={(e) =>
                      setVerifiedChecks((prev) => ({
                        ...prev,
                        [`${reviewTarget.user.id}-lic`]: e.target.checked,
                      }))
                    }
                    className="accent-blue-600 rounded"
                  />
                  <span>Registry or Medical Council license number verified against official records</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!verifiedChecks[`${reviewTarget.user.id}-phone`]}
                    onChange={(e) =>
                      setVerifiedChecks((prev) => ({
                        ...prev,
                        [`${reviewTarget.user.id}-phone`]: e.target.checked,
                      }))
                    }
                    className="accent-blue-600 rounded"
                  />
                  <span>Applicant identity and primary telephone number confirmed</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!verifiedChecks[`${reviewTarget.user.id}-org`]}
                    onChange={(e) =>
                      setVerifiedChecks((prev) => ({
                        ...prev,
                        [`${reviewTarget.user.id}-org`]: e.target.checked,
                      }))
                    }
                    className="accent-blue-600 rounded"
                  />
                  <span>Physical premises, clinic, or facility verified in good standing</span>
                </label>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
              <Button variant="ghost" onClick={() => setReviewTarget(null)}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                {reviewTarget.user.status === "pending" || reviewTarget.user.status === "suspended" ? (
                  <>
                    <Button
                      variant="danger"
                      onClick={() => {
                        setRejectTarget(reviewTarget);
                      }}
                    >
                      <XCircle size={15} className="mr-1.5" />
                      Reject Application
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => approve.mutate(reviewTarget.user.id)}
                      loading={approve.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 size={15} className="mr-1.5" />
                      Approve Account
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ─── Rejection Reason Modal ─────────────────────────── */}
      <Modal
        open={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        title={rejectTarget ? `Reject Application: ${rejectTarget.user.name}` : "Reject Application"}
      >
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!rejectTarget) return;
            if (rejectReason.trim().length < 3) {
              toast.error("Reason required", "Please select or type a short explanation.");
              return;
            }
            reject.mutate({
              userId: rejectTarget.user.id,
              reason: rejectReason.trim(),
            });
          }}
        >
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
            <p>
              The rejection reason will be recorded on the user profile and included in their email notification.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Quick Reason Presets:</label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REJECTION_REASONS.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRejectReason(r)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border text-left transition-colors cursor-pointer ${
                    rejectReason === r
                      ? "bg-red-100 text-red-900 border-red-300 font-semibold"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <Field label="Custom Explanation" htmlFor="reject-reason" required>
            <Input
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. SLMC number could not be verified with official medical registry"
              maxLength={500}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="ghost" type="button" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button type="submit" variant="danger" loading={reject.isPending}>
              Confirm Rejection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}