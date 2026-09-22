"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  CalendarDays,
  Clock3,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { Pill, PillRow } from "@/portal/components/ui/Pill";
import { SectionHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Select } from "@/portal/components/ui/Form";
import { NotesPanel } from "@/portal/components/admin/NotesPanel";
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

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  active: "success",
  pending: "warn",
  suspended: "danger",
  rejected: "danger",
};

const ROLE_TONE: Record<
  string,
  "neutral" | "info" | "violet" | "accent" | "success" | "warn" | "danger" | "brand"
> = {
  patient: "neutral",
  doctor: "info",
  hospital_admin: "violet",
  hospital_staff: "violet",
  laboratory: "accent",
  pharmacy: "success",
  insurance: "warn",
  ambulance: "danger",
  super_admin: "brand",
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

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminQk.user(id),
    queryFn: () => adminApi<Payload>(`/admin/users/${id}`),
  });

  const [editRole, setEditRole] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<string | null>(null);

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
      <div className="flex flex-col gap-5 max-w-6xl">
        <div className="admin-shimmer h-44 rounded-3xl border border-border" role="status" aria-label="Loading" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="admin-shimmer h-64 rounded-3xl border border-border lg:col-span-2" />
          <div className="admin-shimmer h-64 rounded-3xl border border-border" />
        </div>
      </div>
    );
  }
  const u = data.user;
  const dirty = editRole !== null || editStatus !== null;

  return (
    <div className="flex flex-col gap-5 max-w-6xl">
      <Link
        href="/admin/users"
        className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-text-soft transition-colors hover:text-blue-700"
      >
        <ArrowLeft size={13} aria-hidden />
        Back to users
      </Link>

      {/* ── Identity hero ─────────────────────────────────────────── */}
      <section className="portal-card relative overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        {/* Oceanic banner strip */}
        <div
          className="relative h-24 overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, #0B4A6F 0%, #0369A1 45%, #0E7490 75%, #14919B 100%)",
          }}
        >
          <div
            className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 65%)" }}
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
            }}
            aria-hidden
          />
        </div>

        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4 -mt-10">
            <div
              aria-hidden
              className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-2xl font-extrabold text-white shadow-lg ring-4 ring-surface"
            >
              {initials(u.name)}
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-2xl font-extrabold tracking-tight text-text">
                {u.name}
              </h1>
              <div className="mt-1.5">
                <PillRow>
                  <Pill tone={ROLE_TONE[u.role] ?? "neutral"}>{u.role.replace(/_/g, " ")}</Pill>
                  <Pill tone={STATUS_TONE[u.status] ?? "neutral"}>{u.status}</Pill>
                  {u.verified ? <Pill tone="success">NIC verified</Pill> : null}
                </PillRow>
              </div>
            </div>
          </div>

          {/* Meta chips */}
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-text-soft sm:justify-end sm:pb-1">
            <span className="inline-flex items-center gap-1.5">
              <Mail size={12} className="text-blue-600" aria-hidden />
              {u.email || "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone size={12} className="text-blue-600" aria-hidden />
              {u.phone || "—"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} className="text-blue-600" aria-hidden />
              Joined {new Date(u.createdAt).toLocaleDateString()}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock3 size={12} className="text-blue-600" aria-hidden />
              {u.lastLoginAt
                ? `Last login ${new Date(u.lastLoginAt).toLocaleString()}`
                : "Never logged in"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <section className="portal-card bg-surface border border-border rounded-2xl p-5">
            <SectionHeader
              title="Account details"
              icon={<UserRound size={16} className="text-blue-600" />}
            />
            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
              <Field label="Email">{u.email || "—"}</Field>
              <Field label="Phone">{u.phone || "—"}</Field>
              <Field label="Date of birth">{u.dateOfBirth || "—"}</Field>
              <Field label="NIC">{u.nic || "—"}</Field>
              <Field label="Approved at">
                {u.approvedAt ? new Date(u.approvedAt).toLocaleString() : "—"}
              </Field>
              <Field label="Verified">
                {u.verified ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                    <BadgeCheck size={14} aria-hidden /> Yes
                  </span>
                ) : (
                  "No"
                )}
              </Field>
            </dl>

            {u.suspendedReason || u.rejectionReason ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-danger-soft/60 px-4 py-3">
                {u.suspendedReason ? (
                  <p className="text-sm text-red-800">
                    <span className="font-bold">Suspension reason:</span> {u.suspendedReason}
                  </p>
                ) : null}
                {u.rejectionReason ? (
                  <p className="mt-1 text-sm text-red-800">
                    <span className="font-bold">Rejection reason:</span> {u.rejectionReason}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {data.profiles.doctor ? (
            <section className="portal-card bg-surface border border-border rounded-2xl p-5">
              <SectionHeader
                title="Doctor profile"
                icon={<Stethoscope size={16} className="text-blue-600" />}
                right={
                  data.profiles.doctor.slmcVerifiedAt ? (
                    <Pill tone="success">SLMC verified</Pill>
                  ) : (
                    <Pill tone="warn">SLMC pending</Pill>
                  )
                }
              />
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
                <Field label="Specialization">{data.profiles.doctor.specialization}</Field>
                <Field label="SLMC #">{data.profiles.doctor.slmcRegistrationNo || "—"}</Field>
                <Field label="SLMC verified at">
                  {data.profiles.doctor.slmcVerifiedAt
                    ? new Date(data.profiles.doctor.slmcVerifiedAt).toLocaleString()
                    : "—"}
                </Field>
                <Field label="Rating">{data.profiles.doctor.rating ?? "—"}</Field>
              </dl>
            </section>
          ) : null}

          {data.profiles.hospital ? (
            <section className="portal-card bg-surface border border-border rounded-2xl p-5">
              <SectionHeader
                title="Hospital"
                icon={<Building2 size={16} className="text-blue-600" />}
              />
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
                <Field label="Name">{data.profiles.hospital.name}</Field>
                <Field label="License">{data.profiles.hospital.license || "—"}</Field>
              </dl>
            </section>
          ) : null}

          {data.profiles.clinic ? (
            <section className="portal-card bg-surface border border-border rounded-2xl p-5">
              <SectionHeader
                title="Clinic"
                icon={<Building2 size={16} className="text-blue-600" />}
              />
              <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-5 text-sm sm:grid-cols-2">
                <Field label="Name">{data.profiles.clinic.name}</Field>
                <Field label="License">{data.profiles.clinic.license || "—"}</Field>
              </dl>
            </section>
          ) : null}

          <NotesPanel userId={id} />
        </div>

        {/* ── Right rail: admin controls ──────────────────────────── */}
        <div className="flex flex-col gap-5 lg:sticky lg:top-4">
          <section className="portal-card overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border/60 bg-gradient-to-r from-blue-50/80 to-indigo-50/50 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-blue-700 ring-1 ring-inset ring-blue-200/60">
                  <ShieldCheck size={17} aria-hidden />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-text">Admin controls</h3>
                  <p className="text-[11px] text-text-muted">Role & status management</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4 p-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Role
                </label>
                <Select
                  value={editRole ?? u.role}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="h-10 w-full capitalize"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r.replace(/_/g, " ")}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                  Status
                </label>
                <Select
                  value={editStatus ?? u.status}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="h-10 w-full capitalize"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
              </div>

              <Button
                onClick={() => save.mutate()}
                loading={save.isPending}
                disabled={!dirty}
                className="portal-btn-block bg-blue-600 hover:bg-blue-700"
              >
                Save changes
              </Button>

              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-muted">
                <Lock size={11} className="mt-0.5 shrink-0" aria-hidden />
                Changes are audited and require step-up confirmation (passkey).
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">{label}</dt>
      <dd className="mt-1 font-medium text-text">{children}</dd>
    </div>
  );
}
