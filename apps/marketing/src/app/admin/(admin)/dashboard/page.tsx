"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Users,
  UserCheck,
  Stethoscope,
  Wallet,
  Receipt,
  FileLock2,
  Megaphone,
  MailCheck,
  ScrollText,
  Activity,
  Pill,
} from "lucide-react";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { adminApi, adminQk } from "@/portal/lib/admin-api";

type Dashboard = {
  generatedAt: string;
  users: {
    byRoleAndStatus: { role: string; status: string; count: number }[];
    pendingApprovals: number;
  };
  doctors: { slmcVerified: number; slmcUnverified: number };
  today: { auditEvents: number; appointments: number; prescriptionsLast7d: number };
  operations: {
    pendingPayouts: number;
    openInsuranceClaims: number;
    openDsarRequests: number;
    newDemoRequests: number;
  };
};

function Tile({
  icon,
  label,
  value,
  href,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href?: string;
  tone?: "neutral" | "warn" | "danger" | "success" | "info";
}) {
  const toneCls = {
    neutral: "bg-surface-2 text-text-soft",
    warn: "bg-warn-soft text-amber-700",
    danger: "bg-danger-soft text-red-700",
    success: "bg-success-soft text-emerald-700",
    info: "bg-info-soft text-sky-700",
  }[tone];
  const content = (
    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${toneCls}`}>{icon}</div>
        <p className="text-xs uppercase tracking-widest text-text-muted font-semibold">{label}</p>
      </div>
      <p className="text-3xl font-extrabold tracking-tight">{value.toLocaleString()}</p>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () => adminApi<Dashboard>("/admin/dashboard"),
    refetchInterval: 60_000,
  });

  return (
    <div className="flex flex-col gap-6 max-w-7xl">
      <PageHeader
        title="Operations dashboard"
        subtitle={
          data
            ? `Last refreshed ${new Date(data.generatedAt).toLocaleString()}`
            : "Loading…"
        }
        icon={<Activity size={20} className="text-amber-600" />}
      />

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Fetching metrics…</p>
      ) : (
        <>
          <section>
            <SectionHeader title="People" className="mb-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile
                icon={<UserCheck size={18} />}
                label="Pending approvals"
                value={data.users.pendingApprovals}
                tone={data.users.pendingApprovals > 0 ? "warn" : "neutral"}
                href="/admin/approvals"
              />
              <Tile
                icon={<Stethoscope size={18} />}
                label="Doctors (SLMC verified)"
                value={data.doctors.slmcVerified}
                tone="success"
                href="/admin/doctors?slmc=verified"
              />
              <Tile
                icon={<Stethoscope size={18} />}
                label="Doctors (not verified)"
                value={data.doctors.slmcUnverified}
                tone="warn"
                href="/admin/doctors?slmc=unverified"
              />
              <Tile
                icon={<Users size={18} />}
                label="Users (all)"
                value={data.users.byRoleAndStatus.reduce((acc, r) => acc + r.count, 0)}
                href="/admin/users"
              />
            </div>
          </section>

          <section>
            <SectionHeader title="Today" className="mb-3" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Tile icon={<Activity size={18} />} label="Audit events" value={data.today.auditEvents} href="/admin/audit" />
              <Tile icon={<Stethoscope size={18} />} label="Appointments" value={data.today.appointments} />
              <Tile icon={<Pill size={18} />} label="Rx (last 7 days)" value={data.today.prescriptionsLast7d} />
            </div>
          </section>

          <section>
            <SectionHeader title="Operations queue" className="mb-3" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Tile
                icon={<Wallet size={18} />}
                label="Pending payouts"
                value={data.operations.pendingPayouts}
                tone={data.operations.pendingPayouts > 0 ? "warn" : "neutral"}
                href="/admin/payouts?status=pending"
              />
              <Tile
                icon={<Receipt size={18} />}
                label="Insurance claims"
                value={data.operations.openInsuranceClaims}
                tone="info"
                href="/admin/insurance-claims"
              />
              <Tile
                icon={<FileLock2 size={18} />}
                label="DSAR open"
                value={data.operations.openDsarRequests}
                tone="warn"
                href="/admin/dsar"
              />
              <Tile
                icon={<Megaphone size={18} />}
                label="New demo requests"
                value={data.operations.newDemoRequests}
                tone="warn"
                href="/admin/demo-requests?status=new"
              />
            </div>
          </section>

          <section>
            <SectionHeader title="Marketing" className="mb-3" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Tile icon={<MailCheck size={18} />} label="Waitlist (total)" value={0} href="/admin/waitlist" />
              <Tile icon={<ScrollText size={18} />} label="Broadcasts sent" value={0} href="/admin/notifications" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}