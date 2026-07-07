"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pill, PillRow } from "@/portal/components/ui/Pill";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

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

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: adminQk.user(id),
    queryFn: () => adminApi<Payload>(`/admin/users/${id}`),
  });

  if (isLoading || !data) {
    return <p className="text-text-soft text-sm">Loading user…</p>;
  }
  const u = data.user;

  return (
    <div className="flex flex-col gap-6 max-w-5xl">
      <PageHeader title={u.name} subtitle={`${u.role} · joined ${new Date(u.createdAt).toLocaleDateString()}`} />

      <section className="bg-surface border border-border rounded-2xl p-5">
        <SectionHeader title="Account" />
        <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
          <Field label="Status"><PillRow><Pill tone={STATUS_TONE[u.status] ?? "neutral"}>{u.status}</Pill></PillRow></Field>
          <Field label="Email"><p>{u.email || "—"}</p></Field>
          <Field label="Phone"><p>{u.phone || "—"}</p></Field>
          <Field label="Date of birth"><p>{u.dateOfBirth || "—"}</p></Field>
          <Field label="Approved at"><p>{u.approvedAt ? new Date(u.approvedAt).toLocaleString() : "—"}</p></Field>
          <Field label="Suspension reason"><p className="text-red-700">{u.suspendedReason || "—"}</p></Field>
          <Field label="Rejection reason"><p className="text-red-700">{u.rejectionReason || "—"}</p></Field>
          <Field label="Verified NIC"><p>{u.verified ? "Yes" : "No"}</p></Field>
        </dl>
      </section>

      {data.profiles.doctor ? (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <SectionHeader title="Doctor profile" />
          <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <Field label="Specialization"><p>{data.profiles.doctor.specialization}</p></Field>
            <Field label="SLMC #"><p>{data.profiles.doctor.slmcRegistrationNo || "—"}</p></Field>
            <Field label="SLMC verified"><p>{data.profiles.doctor.slmcVerifiedAt ? new Date(data.profiles.doctor.slmcVerifiedAt).toLocaleString() : "No"}</p></Field>
            <Field label="Rating"><p>{data.profiles.doctor.rating ?? "—"}</p></Field>
          </dl>
        </section>
      ) : null}

      {data.profiles.hospital ? (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <SectionHeader title="Hospital" />
          <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <Field label="Name"><p>{data.profiles.hospital.name}</p></Field>
            <Field label="License"><p>{data.profiles.hospital.license || "—"}</p></Field>
          </dl>
        </section>
      ) : null}

      {data.profiles.clinic ? (
        <section className="bg-surface border border-border rounded-2xl p-5">
          <SectionHeader title="Clinic" />
          <dl className="grid grid-cols-2 gap-4 mt-3 text-sm">
            <Field label="Name"><p>{data.profiles.clinic.name}</p></Field>
            <Field label="License"><p>{data.profiles.clinic.license || "—"}</p></Field>
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-widest text-text-muted font-semibold">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}