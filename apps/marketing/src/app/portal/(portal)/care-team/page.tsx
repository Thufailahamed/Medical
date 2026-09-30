"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ShieldOff,
  UserPlus,
  ChevronRight,
  HeartHandshake,
  ShieldCheck,
  Timer,
  PenLine,
  Users,
} from "lucide-react";
import Link from "next/link";
import { z } from "zod";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Drawer } from "@/portal/components/ui/Modal";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import {
  RHFFormProvider,
  RHFInput,
  RHFSelect,
} from "@/portal/components/ui/FormKit";
import { Avatar } from "@/portal/components/ui/Avatar";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  LIST_ROW,
  PANEL,
  PanelHeader,
  PanelSearch,
  PRIMARY_BTN,
  ROW_LINK,
  RowAccent,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

const inviteSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  patientQuery: z.string().optional(),
  scope: z.enum(["read", "read_write"]),
  role: z.enum(["primary_care", "specialist", "consultant"]),
  days: z
    .string()
    .refine((v) => !v || /^\d+$/.test(v), { message: "Must be a positive number" })
    .refine((v) => !v || Number(v) > 0, { message: "Must be greater than 0" })
    .refine((v) => !v || Number(v) <= 3650, { message: "Must be 3650 days or fewer" }),
});

type InviteValues = z.infer<typeof inviteSchema>;

interface Member {
  id: string;
  patientId: string;
  patientName: string;
  patientPhoto?: string | null;
  role: string;
  scope: string;
  grantedAt?: string;
  expiresAt?: string | null;
  active?: boolean;
}

interface InviteResponse {
  members?: Member[];
  grants?: Member[];
}

type Filter = "all" | "active" | "expiring" | "inactive";

function humanize(v: string) {
  return v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CareTeamPage() {
  const t = useT();
  const qc = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["care-team"],
    queryFn: () => api<InviteResponse>(`/care-team`),
  });

  const members: Member[] = (data?.members ?? data?.grants ?? []) as Member[];

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/care-team/${id}`, { method: "PATCH", json: { status: "revoked" } }),
    onSuccess: () => {
      toast.success(t("careTeam.accessRevoked"));
      qc.invalidateQueries({ queryKey: ["care-team"] });
    },
    onError: (err: unknown) => toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  const [now] = useState(() => Date.now());
  const expiringSoon = (m: Member) =>
    !!m.active && !!m.expiresAt && Date.parse(m.expiresAt) - now < 30 * 86_400_000;
  const activeCount = members.filter((m) => m.active).length;
  const writeCount = members.filter((m) => m.active && m.scope === "read_write").length;
  const soonCount = members.filter(expiringSoon).length;
  const inactiveCount = members.length - activeCount;

  const shown = members.filter((m) => {
    if (filter === "active" && !m.active) return false;
    if (filter === "inactive" && m.active) return false;
    if (filter === "expiring" && !expiringSoon(m)) return false;
    const term = q.trim().toLowerCase();
    return !term || m.patientName.toLowerCase().includes(term) || m.role.toLowerCase().includes(term);
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<HeartHandshake size={13} aria-hidden />}
          kicker="Shared care"
          kickerMeta={`${activeCount} active grant${activeCount === 1 ? "" : "s"}`}
          title={
            <>
              Care{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                team
              </span>
            </>
          }
          description={t("careTeam.subtitle")}
          chips={
            <>
              <span className={HERO_CHIP}>
                <ShieldCheck size={12} className="text-emerald-300" aria-hidden />
                Patient-consented, time-limited access
              </span>
              {soonCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setFilter("expiring")}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <Timer size={12} aria-hidden />
                  {soonCount} expiring within 30 days
                </button>
              ) : null}
            </>
          }
          actions={
            <button type="button" onClick={() => setInviteOpen(true)} className={HERO_PRIMARY}>
              <UserPlus size={15} className="text-sky-600" aria-hidden />
              {t("careTeam.invite")}
            </button>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Active grants"
            icon={<ShieldCheck size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={isLoading ? "…" : String(activeCount)}
            sub="Charts you can open"
            progress={members.length > 0 ? Math.round((activeCount / members.length) * 100) : null}
            active={filter === "active"}
            onClick={() => setFilter("active")}
          />
          <StatTile
            label="Read & write"
            icon={<PenLine size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(writeCount)}
            sub={`${activeCount - writeCount} read-only`}
          />
          <StatTile
            label="Expiring soon"
            icon={<Timer size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(soonCount)}
            sub="Within 30 days"
            pulse={soonCount > 0}
            active={filter === "expiring"}
            onClick={() => setFilter("expiring")}
          />
          <StatTile
            label="All grants"
            icon={<Users size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={String(members.length)}
            sub={inactiveCount > 0 ? `${inactiveCount} revoked or expired` : "No revoked access"}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
        </HeroOverlap>
      </div>

      <section className={PANEL} aria-labelledby="ct-list">
        <PanelHeader
          id="ct-list"
          icon={<HeartHandshake size={16} />}
          tone="bg-indigo-50 text-indigo-600"
          title="Access grants"
          caption={isLoading ? "Loading…" : `${shown.length} of ${members.length} shown`}
        />

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <PanelSearch value={q} onChange={setQ} placeholder="Search patient or role…" ariaLabel="Search care team" />
          <Segmented<Filter>
            ariaLabel="Filter grants"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All", count: members.length },
              { value: "active", label: t("common.active"), count: activeCount },
              { value: "expiring", label: "Expiring", count: soonCount },
              { value: "inactive", label: t("common.inactive"), count: inactiveCount },
            ]}
          />
        </div>

        {isLoading ? (
          <div className="mt-5 space-y-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyBlock
            icon={<HeartHandshake size={19} />}
            title={members.length === 0 ? t("careTeam.empty") : "No matching grants"}
            body={
              members.length === 0
                ? "Invite yourself onto a patient's care team to get consented access to their chart."
                : "Try another name or clear the filter."
            }
            actions={
              <button type="button" onClick={() => setInviteOpen(true)} className={PRIMARY_BTN}>
                <UserPlus size={13} />
                {t("careTeam.invite")}
              </button>
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {shown.map((m) => {
              const soon = expiringSoon(m);
              return (
                <li key={m.id} className={LIST_ROW}>
                  <RowAccent className={!m.active ? "bg-slate-300" : soon ? "bg-amber-400" : "bg-emerald-500"} />
                  <Link href={`/portal/patients/${m.patientId}`} className="flex min-w-0 flex-1 items-center gap-3.5 pl-1.5">
                    <Avatar name={m.patientName} src={m.patientPhoto ?? undefined} size="md" className="h-10 w-10 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                          {m.patientName}
                        </span>
                        {m.active ? (
                          <Pill tone={soon ? "warn" : "success"}>{soon ? "Expiring" : t("common.active")}</Pill>
                        ) : (
                          <Pill tone="neutral">{t("common.inactive")}</Pill>
                        )}
                      </div>
                      <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-slate-400">
                        <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                          {humanize(m.role)}
                        </span>
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600">
                          {m.scope === "read_write" ? t("careTeam.scopeReadWrite") : t("careTeam.scopeRead")}
                        </span>
                        {m.grantedAt ? <span>{t("careTeam.since", { date: formatDate(m.grantedAt) })}</span> : null}
                        {m.expiresAt ? (
                          <span className={soon ? "font-semibold text-amber-600" : undefined}>
                            · until {formatDate(m.expiresAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1.5 pl-1.5 sm:pl-0">
                    {m.active ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(t("careTeam.revokeConfirm", { name: m.patientName }))) revoke.mutate(m.id);
                        }}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <ShieldOff size={12} />
                        {t("careTeam.revoke")}
                      </button>
                    ) : null}
                    <Link href={`/portal/patients/${m.patientId}`} className={ROW_LINK}>
                      {t("common.open")}
                      <ChevronRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Drawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={t("careTeam.inviteTitle")}
        subtitle={t("careTeam.subtitle")}
        size="md"
      >
        <InviteForm
          onSaved={() => {
            setInviteOpen(false);
            qc.invalidateQueries({ queryKey: ["care-team"] });
          }}
          onCancel={() => setInviteOpen(false)}
        />
      </Drawer>
    </div>
  );
}

function InviteForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const t = useT();
  const [q, setQ] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["doctor", "search-patients", q],
    queryFn: () =>
      api<{ patients: Array<{ patient: { id: string }; user: { name: string } }> }>(
        `/doctor/search-patients?q=${encodeURIComponent(q)}&limit=10`
      ),
    enabled: q.length > 0,
  });

  const create = useMutation({
    mutationFn: (values: InviteValues) =>
      api(`/care-team`, {
        method: "POST",
        json: {
          patientId: values.patientId,
          scope: values.scope,
          role: values.role,
          expiresInDays: values.days ? Number(values.days) : null,
        },
      }),
    onSuccess: () => {
      toast.success(t("careTeam.inviteSent"));
      onSaved();
    },
    onError: (err: unknown) => toast.error(t("toast.error"), err instanceof Error ? err.message : undefined),
  });

  return (
    <RHFFormProvider
      schema={inviteSchema}
      defaultValues={{
        patientId: "",
        patientQuery: "",
        scope: "read",
        role: "specialist",
        days: "365",
      }}
      mode="onSubmit"
    >
      {(form) => (
        <form
          onSubmit={form.handleSubmit((values) => create.mutate(values))}
          className="flex flex-col gap-3"
        >
          <Input
            label={t("careTeam.searchPatient")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("careTeam.searchPlaceholder")}
          />
          {data?.patients && data.patients.length > 0 && !form.watch("patientId") ? (
            <ul className="border border-border/60 rounded-xl divide-y divide-border/50 max-h-40 overflow-y-auto">
              {data.patients.map((p) => (
                <li key={p.patient.id}>
                  <button
                    type="button"
                    onClick={() => {
                      form.setValue("patientId", p.patient.id, { shouldValidate: true });
                      setQ(p.user.name);
                      setSelectedName(p.user.name);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2/40 flex items-center gap-2 transition-colors"
                  >
                    <Avatar name={p.user.name} size="xs" />
                    <span className="truncate">{p.user.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {selectedName ? (
            <div className="text-xs text-success">
              {t("careTeam.patientSelected", { id: selectedName })}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <RHFSelect
              name="scope"
              label={t("careTeam.scope")}
              options={[
                { value: "read", label: t("careTeam.scopeRead") },
                { value: "read_write", label: t("careTeam.scopeReadWrite") },
              ]}
            />
            <RHFSelect
              name="role"
              label={t("careTeam.role")}
              options={[
                { value: "primary_care", label: t("careTeam.rolePrimaryCare") },
                { value: "specialist", label: t("careTeam.roleSpecialist") },
                { value: "consultant", label: t("careTeam.roleConsultant") },
              ]}
            />
            <RHFInput
              name="days"
              label={t("careTeam.validForDays")}
              type="number"
              placeholder="365"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>{t("common.cancel")}</Button>
            <Button
              type="submit"
              leftIcon={<UserPlus size={14} />}
              loading={create.isPending}
            >
              {t("careTeam.invite")}
            </Button>
          </div>
        </form>
      )}
    </RHFFormProvider>
  );
}
