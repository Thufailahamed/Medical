"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Building2,
  Cake,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Fingerprint,
  Hash,
  Hospital,
  IdCard,
  Lock,
  Mail,
  Phone,
  RotateCcw,
  ShieldCheck,
  Star,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { NotesPanel } from "@/portal/components/admin/NotesPanel";
import { cn } from "@/portal/lib/utils";
import { relativeTime } from "@/portal/lib/format";
import {
  DoctorHero,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { InfoField, humanize } from "@/portal/components/admin/AdminDirectory";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type User = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  rejectionReason: string | null;
  suspendedReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  dateOfBirth: string | null;
  nic: string | null;
  verified: boolean | null;
  lastLoginAt: string | null;
};

type Payload = {
  user: User;
  profiles: {
    doctor: { id: string; specialization: string; slmcRegistrationNo: string | null; slmcVerifiedAt: string | null; rating: number | null } | null;
    hospital: { id: string; name: string; license: string | null } | null;
    clinic: { id: string; name: string; license: string | null } | null;
  };
};

const ROLES = [
  "patient",
  "doctor",
  "hospital_admin",
  "hospital_staff",
  "laboratory",
  "pharmacy",
  "insurance",
  "ambulance",
  "super_admin",
] as const;

const STATUSES = ["pending", "active", "suspended", "rejected"] as const;

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

const STATUS_META: Record<string, { dot: string; ring: string; hint: string }> = {
  pending: { dot: "bg-amber-400", ring: "shadow-[inset_0_0_0_1.5px_#f59e0b]", hint: "Waiting for approval" },
  active: { dot: "bg-emerald-500", ring: "shadow-[inset_0_0_0_1.5px_#10b981]", hint: "Can sign in" },
  suspended: { dot: "bg-red-500", ring: "shadow-[inset_0_0_0_1.5px_#ef4444]", hint: "Blocked from sign-in" },
  rejected: { dot: "bg-slate-400", ring: "shadow-[inset_0_0_0_1.5px_#94a3b8]", hint: "Application declined" },
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminQk.user(id),
    queryFn: () => adminApi<Payload>(`/admin/users/${id}`),
  });

  const [editRole, setEditRole] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());

  const save = useMutation({
    mutationFn: () =>
      adminApiWithStepUp(`/admin/users/${id}`, {
        method: "PATCH",
        json: {
          ...(editRole ? { role: editRole } : {}),
          ...(editStatus ? { status: editStatus } : {}),
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin", "users", id] });
      setEditRole(null);
      setEditStatus(null);
    },
    onError: (e: unknown) =>
      toast.error("Save failed", e instanceof Error ? e.message : "Unexpected error"),
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6" role="status" aria-label="Loading">
        <div className="h-56 animate-pulse rounded-[20px] bg-slate-200/70" />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100 xl:col-span-8" />
          <div className="h-72 animate-pulse rounded-2xl bg-slate-100 xl:col-span-4" />
        </div>
      </div>
    );
  }

  const u = data.user;
  const nextRole = editRole ?? u.role;
  const nextStatus = editStatus ?? u.status;
  const dirty = (editRole !== null && editRole !== u.role) || (editStatus !== null && editStatus !== u.status);
  const daysSinceJoin = Math.max(0, Math.floor((now - Date.parse(u.createdAt)) / 86_400_000));
  const doc = data.profiles.doctor;
  const org = data.profiles.hospital
    ? { kind: "hospital" as const, ...data.profiles.hospital }
    : data.profiles.clinic
      ? { kind: "clinic" as const, ...data.profiles.clinic }
      : null;

  const copyId = () => {
    navigator.clipboard?.writeText(u.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      <Link
        href="/admin/users"
        className="group inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
      >
        <ArrowLeft size={13} className="transition-transform group-hover:-translate-x-0.5" aria-hidden />
        Back to users
      </Link>

      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          leading={
            <span className="relative grid h-[76px] w-[76px] place-items-center rounded-[20px] bg-gradient-to-br from-sky-400 to-blue-600 text-2xl font-semibold tracking-[-0.02em] text-white shadow-[0_12px_32px_-8px_rgba(14,165,233,0.6)] ring-1 ring-inset ring-white/25">
              {initials(u.name)}
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-[3px] border-[#07233a]",
                  STATUS_META[u.status]?.dot ?? "bg-slate-400",
                )}
                aria-hidden
              />
            </span>
          }
          kickerIcon={<UserRound size={13} aria-hidden />}
          kicker="User record"
          kickerMeta={humanize(u.role)}
          title={u.name}
          description={[u.email, u.phone].filter(Boolean).join(" · ") || "No contact details on file"}
          chips={
            <>
              <span className={HERO_CHIP}>
                <span className={cn("h-2 w-2 rounded-full", STATUS_META[u.status]?.dot ?? "bg-slate-400")} aria-hidden />
                {humanize(u.status)}
              </span>
              {u.verified ? (
                <span className={HERO_CHIP}>
                  <BadgeCheck size={12} className="text-emerald-300" aria-hidden />
                  NIC verified
                </span>
              ) : null}
              {doc ? (
                <span className={HERO_CHIP}>
                  <Stethoscope size={12} className={doc.slmcVerifiedAt ? "text-emerald-300" : "text-amber-300"} aria-hidden />
                  {doc.slmcVerifiedAt ? "SLMC verified" : "SLMC pending"}
                </span>
              ) : null}
              <button type="button" onClick={copyId} className={cn(HERO_CHIP, "font-mono transition-colors hover:bg-white/10")} title="Copy user ID">
                {copied ? <Check size={12} className="text-emerald-300" aria-hidden /> : <Copy size={12} aria-hidden />}
                {u.id.slice(0, 8)}…
              </button>
            </>
          }
          actions={
            <>
              {u.phone ? (
                <a href={`tel:${u.phone}`} className={HERO_GHOST}>
                  <Phone size={15} aria-hidden />
                  Call
                </a>
              ) : null}
              {u.email ? (
                <a href={`mailto:${u.email}`} className={HERO_PRIMARY}>
                  <Mail size={15} className="text-sky-600" aria-hidden />
                  Email user
                </a>
              ) : null}
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Status"
            icon={<ShieldCheck size={16} />}
            tone={u.status === "active" ? "bg-emerald-50 text-emerald-600" : u.status === "pending" ? "bg-amber-50 text-amber-600" : "bg-red-50 text-red-600"}
            value={humanize(u.status)}
            sub={STATUS_META[u.status]?.hint ?? "Account state"}
            pulse={u.status === "pending"}
          />
          <StatTile
            label="Role"
            icon={<IdCard size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={humanize(u.role)}
            sub={u.approvedAt ? `Approved ${new Date(u.approvedAt).toLocaleDateString()}` : "Not yet approved"}
          />
          <StatTile
            label="Member for"
            icon={<CalendarDays size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(daysSinceJoin)}
            unit={daysSinceJoin === 1 ? "day" : "days"}
            sub={`Joined ${new Date(u.createdAt).toLocaleDateString()}`}
          />
          <StatTile
            label="Last seen"
            icon={<Clock3 size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never"}
            sub={u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Has not signed in"}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Main column ─────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          {u.suspendedReason || u.rejectionReason ? (
            <div className="flex items-start gap-3 rounded-2xl bg-gradient-to-br from-red-50 to-white p-4 ring-1 ring-inset ring-red-600/15">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-red-500 text-white shadow-sm shadow-red-500/30">
                <AlertTriangle size={17} aria-hidden />
              </span>
              <div className="min-w-0 text-sm">
                {u.suspendedReason ? (
                  <p className="text-red-900">
                    <span className="font-semibold">Suspended:</span> {u.suspendedReason}
                  </p>
                ) : null}
                {u.rejectionReason ? (
                  <p className="mt-0.5 text-red-900">
                    <span className="font-semibold">Rejected:</span> {u.rejectionReason}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <section className={PANEL} aria-labelledby="usr-details">
            <PanelHeader id="usr-details" icon={<UserRound size={16} />} tone="bg-sky-50 text-sky-600" title="Account details" caption="Identity and contact on file" />
            <dl className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <InfoField icon={<Mail size={15} />} label="Email" copyValue={u.email}>{u.email || "—"}</InfoField>
              <InfoField icon={<Phone size={15} />} label="Phone" copyValue={u.phone}>{u.phone || "—"}</InfoField>
              <InfoField icon={<Cake size={15} />} label="Date of birth">{u.dateOfBirth || "—"}</InfoField>
              <InfoField icon={<Fingerprint size={15} />} label="NIC" mono copyValue={u.nic}>{u.nic || "—"}</InfoField>
              <InfoField icon={<BadgeCheck size={15} />} label="Approved at">
                {u.approvedAt ? new Date(u.approvedAt).toLocaleString() : "—"}
              </InfoField>
              <InfoField icon={<ShieldCheck size={15} />} label="Identity verified">
                {u.verified ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                    <BadgeCheck size={14} aria-hidden /> Verified
                  </span>
                ) : (
                  <span className="text-slate-500">Not verified</span>
                )}
              </InfoField>
            </dl>
          </section>

          {doc ? (
            <section className={PANEL} aria-labelledby="usr-doctor">
              <PanelHeader
                id="usr-doctor"
                icon={<Stethoscope size={16} />}
                tone="bg-emerald-50 text-emerald-600"
                title="Doctor profile"
                caption="Clinical registration"
                href={doc.slmcVerifiedAt ? "/admin/doctors?slmc=verified" : "/admin/doctors?slmc=unverified"}
                linkLabel="SLMC review"
              />
              <div
                className={cn(
                  "mt-5 flex items-center gap-3 rounded-xl p-3.5",
                  doc.slmcVerifiedAt ? "bg-emerald-50/70 ring-1 ring-inset ring-emerald-600/10" : "bg-amber-50/70 ring-1 ring-inset ring-amber-600/15",
                )}
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-[10px] text-white", doc.slmcVerifiedAt ? "bg-emerald-500" : "bg-amber-500")}>
                  {doc.slmcVerifiedAt ? <BadgeCheck size={17} /> : <Clock3 size={17} />}
                </span>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-semibold text-slate-900">{doc.slmcVerifiedAt ? "SLMC registration verified" : "SLMC verification pending"}</p>
                  <p className="text-xs text-slate-500">
                    {doc.slmcVerifiedAt ? `Verified ${new Date(doc.slmcVerifiedAt).toLocaleString()}` : "Review uploaded documents before this doctor can practise."}
                  </p>
                </div>
              </div>
              <dl className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                <InfoField icon={<Stethoscope size={15} />} label="Specialization">{doc.specialization}</InfoField>
                <InfoField icon={<Hash size={15} />} label="SLMC number" mono copyValue={doc.slmcRegistrationNo}>{doc.slmcRegistrationNo || "—"}</InfoField>
                <InfoField icon={<Star size={15} />} label="Rating">{doc.rating != null ? `${doc.rating.toFixed(1)} / 5` : "—"}</InfoField>
              </dl>
            </section>
          ) : null}

          {org ? (
            <Link
              href={`/admin/tenants/${org.kind}/${org.id}`}
              className="group flex items-center gap-4 rounded-2xl bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-16px_rgba(15,23,42,0.25),inset_0_0_0_1px_rgba(2,132,199,0.25)]"
            >
              <span
                className={cn(
                  "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm",
                  org.kind === "hospital" ? "from-sky-500 to-blue-600 shadow-sky-500/30" : "from-violet-500 to-purple-600 shadow-violet-500/30",
                )}
              >
                {org.kind === "hospital" ? <Building2 size={20} /> : <Hospital size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Owns {org.kind === "hospital" ? "hospital" : "clinic"}
                </span>
                <span className="mt-0.5 block truncate text-[15px] font-semibold text-slate-900 group-hover:text-sky-700">{org.name}</span>
                <span className="block truncate font-mono text-[11px] text-slate-400">{org.license ? `Licence ${org.license}` : "No licence on file"}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-600" />
            </Link>
          ) : null}

          <NotesPanel userId={id} />
        </div>

        {/* ── Right rail: admin controls ──────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-4 xl:col-span-4" aria-label="Admin controls">
          <section className={PANEL} aria-labelledby="usr-controls">
            <PanelHeader id="usr-controls" icon={<ShieldCheck size={16} />} tone="bg-slate-100 text-slate-700" title="Admin controls" caption="Role & account status" />

            <div className="mt-5">
              <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">Status</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {STATUSES.map((st) => {
                  const on = nextStatus === st;
                  const m = STATUS_META[st];
                  return (
                    <button
                      key={st}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setEditStatus(st === u.status ? null : st)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] font-semibold transition-all",
                        on ? cn("bg-white text-slate-900", m.ring) : "bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-800",
                      )}
                    >
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", m.dot)} aria-hidden />
                      {humanize(st)}
                      {st === u.status ? <span className="ml-auto text-[10px] font-medium text-slate-400">current</span> : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="role-select" className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Role
              </label>
              <select
                id="role-select"
                value={nextRole}
                onChange={(e) => setEditRole(e.target.value === u.role ? null : e.target.value)}
                className="mt-2 h-10 w-full rounded-xl bg-slate-50 px-3 text-sm font-medium text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none transition-all focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {humanize(r)}
                  </option>
                ))}
              </select>
            </div>

            {dirty ? (
              <div className="mt-5 rounded-xl bg-sky-50/70 p-3 text-xs ring-1 ring-inset ring-sky-600/10">
                <p className="font-semibold text-sky-900">Pending changes</p>
                <ul className="mt-1.5 flex flex-col gap-1 text-slate-600">
                  {editRole !== null && editRole !== u.role ? (
                    <li className="flex items-center gap-1.5">
                      Role <span className="font-medium text-slate-900">{humanize(u.role)}</span>
                      <ArrowRight size={11} className="text-slate-400" />
                      <span className="font-semibold text-sky-700">{humanize(editRole)}</span>
                    </li>
                  ) : null}
                  {editStatus !== null && editStatus !== u.status ? (
                    <li className="flex items-center gap-1.5">
                      Status <span className="font-medium text-slate-900">{humanize(u.status)}</span>
                      <ArrowRight size={11} className="text-slate-400" />
                      <span className="font-semibold text-sky-700">{humanize(editStatus)}</span>
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => save.mutate()}
                disabled={!dirty || save.isPending}
                className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#07233a] text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                <Lock size={14} aria-hidden />
                {save.isPending ? "Saving…" : "Save changes"}
              </button>
              {dirty ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditRole(null);
                    setEditStatus(null);
                  }}
                  aria-label="Discard changes"
                  title="Discard changes"
                  className="grid h-10 w-10 place-items-center rounded-xl text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-slate-900"
                >
                  <RotateCcw size={15} />
                </button>
              ) : null}
            </div>

            <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-400">
              <Lock size={11} className="mt-0.5 shrink-0" aria-hidden />
              Changes are audited and require passkey step-up confirmation.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
