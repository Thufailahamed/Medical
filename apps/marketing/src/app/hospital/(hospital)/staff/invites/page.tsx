"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  MailPlus,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatDate } from "@/hospital/lib/format";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_INPUT,
  HeroPulse,
  PanelSkeleton,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

interface Invite {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
}

function inviteState(i: Invite): "accepted" | "revoked" | "pending" {
  return i.acceptedAt ? "accepted" : i.revokedAt ? "revoked" : "pending";
}

const STATE_BADGE: Record<string, string> = {
  accepted: TONE_BADGE.emerald,
  revoked: TONE_BADGE.slate,
  pending: TONE_BADGE.amber,
};

const STATE_RAIL: Record<string, "emerald" | "slate" | "amber"> = {
  accepted: "emerald",
  revoked: "slate",
  pending: "amber",
};

const STATE_ICON: Record<string, React.ReactNode> = {
  accepted: <CheckCircle2 size={16} />,
  revoked: <XCircle size={16} />,
  pending: <Clock size={16} />,
};

export default function StaffInvitesPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "hospital_staff",
    departmentId: "",
  });

  const list = useQuery({
    queryKey: ["staffInvites"],
    queryFn: () => api<{ invites: Invite[] }>("/hospital-portal/staff/invites"),
  });

  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ departments: Department[] }>("/hospital-portal/departments"),
  });

  const create = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api("/hospital-portal/staff/invites", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffInvites"] });
      setOpen(false);
      setForm({ email: "", name: "", role: "hospital_staff", departmentId: "" });
      toast.success("Invite created");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-portal/staff/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staffInvites"] }),
  });

  const invites = list.data?.invites ?? [];
  const pending = invites.filter((i) => inviteState(i) === "pending").length;
  const accepted = invites.filter((i) => inviteState(i) === "accepted").length;
  const revoked = invites.filter((i) => inviteState(i) === "revoked").length;

  const hero = (
    <DoctorHero
      kickerIcon={<Mail size={13} aria-hidden />}
      kicker={t("nav.admin")}
      kickerMeta={t("nav.staffInvites")}
      title={
        <>
          {t("nav.staffInvites")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · onboarding
          </span>
        </>
      }
      description={`${pending} pending · ${accepted} accepted · ${revoked} revoked`}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Clock size={12} className="text-amber-300" />
            {pending} pending
          </span>
          <span className={HERO_CHIP}>
            <CheckCircle2 size={12} className="text-emerald-300" />
            {accepted} accepted
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<MailPlus size={18} />}
          label="Pending"
          value={list.isLoading ? "…" : pending}
          sub={`${invites.length} ${t("nav.staffInvites").toLowerCase()}`}
        />
      }
      actions={
        <>
          <button type="button" onClick={() => list.refetch()} className={HERO_GHOST}>
            <RefreshCw size={13} className={list.isFetching ? "animate-spin" : ""} />
            {t("common.refresh")}
          </button>
          <Link href="/hospital/staff" className={HERO_GHOST}>
            <Users size={14} />
            {t("nav.staff")}
          </Link>
          <button type="button" onClick={() => setOpen(true)} className={HERO_PRIMARY}>
            <MailPlus size={14} className="text-emerald-600" />
            {t("staff.inviteStaff")}
          </button>
        </>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Mail size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("common.all")}
          value={list.isLoading ? "…" : String(invites.length)}
          sub={t("nav.staffInvites")}
        />
        <StatTile
          icon={<Clock size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Pending"
          value={list.isLoading ? "…" : String(pending)}
          sub="Awaiting acceptance"
          pulse={pending > 0}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Accepted"
          value={list.isLoading ? "…" : String(accepted)}
          sub="Joined the facility"
        />
        <StatTile
          icon={<XCircle size={16} />}
          tone="bg-slate-100 text-slate-600"
          label="Revoked"
          value={list.isLoading ? "…" : String(revoked)}
          sub="Withdrawn invites"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")}>
          <PanelHeader
            icon={<Mail size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={t("nav.staffInvites")}
            caption={list.isLoading ? t("common.loading") : `${invites.length}`}
            action={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <MailPlus size={13} /> {t("staff.inviteStaff")}
              </button>
            }
          />
          {list.isLoading ? (
            <PanelSkeleton rows={4} className="mt-4" />
          ) : !invites.length ? (
            <EmptyBlock
              icon={<Mail size={19} />}
              title={t("staff.noInvites")}
              body="Invite staff members to give them portal access."
              actions={
                <button
                  type="button"
                  onClick={() => setOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <MailPlus size={13} /> {t("staff.inviteStaff")}
                </button>
              }
            />
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {invites.map((i) => {
                const state = inviteState(i);
                return (
                  <li key={i.id}>
                    <RailRow
                      tone={STATE_RAIL[state]}
                      active={state === "pending"}
                      icon={STATE_ICON[state]}
                      title={i.name ? `${i.name} · ${i.email}` : i.email}
                      meta={`${i.role?.replace(/_/g, " ") ?? "—"} · ${formatDate(i.createdAt, locale)}`}
                      trailing={
                        <>
                          <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize", STATE_BADGE[state])}>
                            {state}
                          </span>
                          {state === "pending" ? (
                            <button
                              type="button"
                              onClick={() => revoke.mutate(i.id)}
                              className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                            >
                              <XCircle size={13} aria-hidden />
                              {t("common.delete")}
                            </button>
                          ) : null}
                        </>
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <QuickToolsPanel
            id="invites-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              { icon: Users, label: t("nav.staff"), hint: "Directory", href: "/hospital/staff", tone: "from-sky-500 to-blue-600 shadow-sky-500/30" },
              { icon: Building2, label: t("nav.departments"), hint: "Structure", href: "/hospital/staff/departments", tone: "from-violet-500 to-purple-600 shadow-violet-500/30" },
              { icon: ArrowRight, label: t("nav.settings"), hint: t("settings.title"), href: "/hospital/settings", tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30" },
            ]}
          />
        </aside>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("staff.inviteStaff")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              departmentId: form.departmentId || null,
            });
          }}
        >
          <FormField label={t("common.email")} required>
            <input
              required
              type="email"
              className={FIELD_INPUT}
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label={t("common.name")}>
            <input
              className={FIELD_INPUT}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label={t("staff.role")}>
            <select
              className={FIELD_INPUT}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="hospital_admin">Hospital Admin</option>
              <option value="hospital_staff">Hospital Staff</option>
              <option value="doctor">Doctor</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="laboratory">Laboratory</option>
            </select>
          </FormField>
          <FormField label={t("staff.department")}>
            <select
              className={FIELD_INPUT}
              value={form.departmentId}
              onChange={(e) => setForm({ ...form, departmentId: e.target.value })}
            >
              <option value="">—</option>
              {(departments.data?.departments ?? []).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-[color:var(--ink-border)] px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
            >
              <Send size={13} />
              {t("common.submit")}
            </button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
