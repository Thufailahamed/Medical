"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  CalendarPlus,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  Loader2,
  Mail,
  Pause,
  Phone,
  Play,
  Shield,
  Trash2,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
import { ExportButton } from "@/portal/components/admin/ExportButton";
import { Pill } from "@/portal/components/ui/Pill";
import { Avatar } from "@/portal/components/ui/Avatar";
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
import { ROW_BTN_QUIET, humanize, statusRail } from "@/portal/components/admin/AdminDirectory";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { BulkActionBar } from "@/portal/components/admin/BulkActionBar";
import { adminApi, adminApiWithStepUp, adminQk, setStepUpToken, setImpersonationToken } from "@/portal/lib/admin-api";
import { getPasskey } from "@/portal/lib/webauthn";
import { toast } from "@/portal/components/ui/Toast";

const STATUSES = ["all", "active", "pending", "suspended", "rejected"] as const;

type Row = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  status: string;
  approvedAt: string | null;
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
};

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "neutral"> = {
  active: "success",
  pending: "warn",
  suspended: "danger",
  rejected: "danger",
};

const ROLE_TONE: Record<string, "neutral" | "info" | "violet" | "accent" | "success" | "warn" | "danger" | "brand"> = {
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

const ROLE_DOT: Record<string, string> = {
  patient: "bg-sky-500",
  doctor: "bg-emerald-500",
  hospital_admin: "bg-violet-500",
  hospital_staff: "bg-violet-300",
  laboratory: "bg-teal-500",
  pharmacy: "bg-lime-500",
  insurance: "bg-amber-500",
  ambulance: "bg-red-500",
  super_admin: "bg-slate-700",
};

const ICON_BTN =
  "grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900";

export default function AdminUsersPage() {
  const qc = useQueryClient();
  const [role, setRole] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [suspendTarget, setSuspendTarget] = useState<Row | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [debouncedQ, setDebouncedQ] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  // Platform-wide counts come from the dashboard aggregate so the stat strip
  // stays accurate regardless of the list's filters and page size.
  const { data: dash } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () =>
      adminApi<{ users: { byRoleAndStatus: { role: string; status: string; count: number }[] } }>("/admin/dashboard"),
    staleTime: 60_000,
  });
  const counts = { total: 0, active: 0, pending: 0, suspended: 0, rejected: 0 };
  const byRole = new Map<string, number>();
  for (const r of dash?.users.byRoleAndStatus ?? []) {
    counts.total += r.count;
    if (r.status === "active") counts.active += r.count;
    if (r.status === "pending") counts.pending += r.count;
    if (r.status === "suspended") counts.suspended += r.count;
    if (r.status === "rejected") counts.rejected += r.count;
    byRole.set(r.role, (byRole.get(r.role) ?? 0) + r.count);
  }
  const roleList = [...byRole.entries()].map(([r, count]) => ({ role: r, count })).sort((a, b) => b.count - a.count);

  const params = {
    role: role === "all" ? undefined : role,
    status: statusFilter === "all" ? undefined : statusFilter,
    q: debouncedQ || undefined,
    limit: 100,
  };
  const { data, isLoading } = useQuery({
    queryKey: adminQk.users(params),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (params.role) qs.set("role", params.role);
      if (params.status) qs.set("status", params.status);
      if (params.q) qs.set("q", params.q);
      qs.set("limit", "100");
      return adminApi<{ items: Row[]; total: number }>(`/admin/users?${qs.toString()}`);
    },
  });

  const toggleSuspend = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: "suspend" | "unsuspend"; reason?: string }) =>
      adminApiWithStepUp(`/admin/users/${id}/${action}`, {
        method: "POST",
        json: action === "suspend" ? { reason } : {},
      }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "suspend" ? "Suspended" : "Reactivated");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setSuspendTarget(null);
      setSuspendReason("");
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  const remove = useMutation({
    mutationFn: (id: string) => adminApiWithStepUp(`/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("User deleted");
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  async function refreshStepUp(): Promise<string> {
    const opts = await adminApi<Parameters<typeof getPasskey>[0]>("/admin/webauthn/auth/options", { method: "POST", json: {} });
    const credential = await getPasskey(opts);
    const res = await adminApi<{ stepUpToken: string }>(
      "/admin/webauthn/auth/verify",
      { method: "POST", json: credential },
    );
    setStepUpToken(res.stepUpToken);
    return res.stepUpToken;
  }

  const [impersonateTarget, setImpersonateTarget] = useState<Row | null>(null);

  const impersonate = useMutation({
    mutationFn: (userId: string) =>
      adminApiWithStepUp<{
        token: string;
        expiresAt: string;
        targetUser: { id: string; name: string; email: string; role: string };
      }>(`/admin/impersonate/start`, {
        method: "POST",
        json: { userId },
      }, refreshStepUp),
    onSuccess: (data) => {
      setImpersonationToken({ token: data.token, expiresAt: data.expiresAt, targetUser: data.targetUser });
      toast.success(`Now acting as ${data.targetUser.name}`);
      qc.invalidateQueries({ queryKey: adminQk.impersonateWhoami() });
      setImpersonateTarget(null);
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  const allSelected = !!data && data.items.length > 0 && data.items.every((u) => selected.has(u.id));
  const filtersOn = role !== "all" || statusFilter !== "all" || q.trim() !== "";

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Users size={13} aria-hidden />}
          kicker="People"
          kickerMeta={`${counts.total.toLocaleString()} accounts · ${roleList.length} roles`}
          title={
            <>
              User{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                directory
              </span>
            </>
          }
          description="Search every account on the platform, filter by role or status, and suspend, impersonate or remove users."
          chips={
            <>
              <span className={HERO_CHIP}>
                <CheckCircle2 size={12} className="text-emerald-300" aria-hidden />
                {counts.active.toLocaleString()} active
              </span>
              {counts.pending > 0 ? (
                <Link
                  href="/admin/approvals"
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <Clock size={12} aria-hidden />
                  {counts.pending} awaiting approval
                </Link>
              ) : null}
            </>
          }
          actions={
            <>
              <Link href="/admin/approvals" className={HERO_GHOST}>
                <UserCheck size={15} aria-hidden />
                Approvals
              </Link>
              <div className="[&_button]:h-10 [&_button]:rounded-[10px]">
                <ExportButton
                  exportPath="users"
                  filters={{
                    role: role === "all" ? undefined : role,
                    status: statusFilter === "all" ? undefined : statusFilter,
                    q: debouncedQ || undefined,
                  }}
                />
              </div>
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="All users"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={dash ? counts.total.toLocaleString() : "…"}
            sub={`${roleList.length} roles`}
            active={statusFilter === "all"}
            onClick={() => setStatusFilter("all")}
          />
          <StatTile
            label="Active"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={counts.active.toLocaleString()}
            sub="Can sign in"
            progress={counts.total ? Math.round((counts.active / counts.total) * 100) : null}
            active={statusFilter === "active"}
            onClick={() => setStatusFilter("active")}
          />
          <StatTile
            label="Pending"
            icon={<Clock size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={counts.pending.toLocaleString()}
            sub={counts.pending ? "Awaiting approval" : "Nothing pending"}
            pulse={counts.pending > 0}
            badge={counts.pending ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined}
            active={statusFilter === "pending"}
            onClick={() => setStatusFilter("pending")}
          />
          <StatTile
            label="Suspended"
            icon={<Ban size={16} />}
            tone="bg-red-50 text-red-600"
            value={counts.suspended.toLocaleString()}
            sub={counts.rejected ? `+ ${counts.rejected} rejected` : "Blocked from sign-in"}
            active={statusFilter === "suspended"}
            onClick={() => setStatusFilter("suspended")}
          />
        </HeroOverlap>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        {/* ── Directory ────────────────────────────────────────────────── */}
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="usr-list">
          <PanelHeader
            id="usr-list"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            title={role === "all" ? "All accounts" : humanize(role)}
            caption={
              isLoading || !data
                ? "Loading…"
                : `${data.items.length} of ${data.total.toLocaleString()} shown${selected.size ? ` · ${selected.size} selected` : ""}`
            }
            action={
              filtersOn ? (
                <button
                  type="button"
                  onClick={() => {
                    setRole("all");
                    setStatusFilter("all");
                    setQ("");
                  }}
                  className={ROW_BTN_QUIET}
                >
                  <X size={12} />
                  Reset
                </button>
              ) : undefined
            }
          />

          <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <PanelSearch value={q} onChange={setQ} placeholder="Search name, email or phone…" ariaLabel="Search users" />
            <Segmented<string>
              ariaLabel="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUSES.map((st) => ({ value: st, label: st === "all" ? "All" : humanize(st) }))}
            />
          </div>

          {isLoading || !data ? (
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-[68px] animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : data.items.length === 0 ? (
            <EmptyBlock
              icon={<Users size={19} />}
              title="No users match"
              body="Try another name, or clear the role and status filters."
            />
          ) : (
            <>
              <label className="mt-4 flex cursor-pointer items-center gap-2.5 px-1 text-xs font-medium text-slate-500">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(data.items.map((u) => u.id)) : new Set())}
                  className="h-4 w-4 accent-sky-600"
                />
                Select all on this page
              </label>
              <ul className="mt-2 flex flex-col gap-2">
                {data.items.map((u) => {
                  const on = selected.has(u.id);
                  return (
                    <li key={u.id} className={cn(LIST_ROW, on && "bg-sky-50/60 shadow-[inset_0_0_0_1.5px_rgba(2,132,199,0.35)]")}>
                      <RowAccent className={statusRail(u.status)} />
                      <div className="flex min-w-0 flex-1 items-center gap-3 pl-1.5">
                        <input
                          type="checkbox"
                          checked={on}
                          aria-label={`Select ${u.name}`}
                          onChange={(e) => {
                            const next = new Set(selected);
                            if (e.target.checked) next.add(u.id);
                            else next.delete(u.id);
                            setSelected(next);
                          }}
                          className="h-4 w-4 shrink-0 accent-sky-600"
                        />
                        <Link href={`/admin/users/${u.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                          <Avatar name={u.name} size="md" className="h-10 w-10 shrink-0" />
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-sky-700">
                                {u.name}
                              </span>
                              <Pill tone={ROLE_TONE[u.role] ?? "neutral"}>{humanize(u.role)}</Pill>
                              {u.status !== "active" ? <Pill tone={STATUS_TONE[u.status] ?? "neutral"}>{humanize(u.status)}</Pill> : null}
                            </span>
                            <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                              {u.email ? (
                                <span className="inline-flex min-w-0 items-center gap-1 truncate">
                                  <Mail size={11} />
                                  {u.email}
                                </span>
                              ) : null}
                              {u.phone ? (
                                <span className="hidden items-center gap-1 sm:inline-flex">
                                  <Phone size={11} />
                                  {u.phone}
                                </span>
                              ) : null}
                              <span className="hidden items-center gap-1 sm:inline-flex">
                                <CalendarPlus size={11} />
                                {new Date(u.createdAt).toLocaleDateString()}
                              </span>
                              {u.suspendedReason ? (
                                <span className="inline-flex min-w-0 items-center gap-1 truncate text-red-500" title={u.suspendedReason}>
                                  <Ban size={11} />
                                  {u.suspendedReason}
                                </span>
                              ) : null}
                            </span>
                          </span>
                        </Link>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 pl-1.5 sm:pl-0">
                        {u.role !== "super_admin" ? (
                          <button
                            type="button"
                            onClick={() => setImpersonateTarget(u)}
                            title="Impersonate this user (step-up required)"
                            aria-label={`Impersonate ${u.name}`}
                            className={ICON_BTN}
                          >
                            <Eye size={14} />
                          </button>
                        ) : null}
                        {u.status === "suspended" ? (
                          <button
                            type="button"
                            onClick={() => toggleSuspend.mutate({ id: u.id, action: "unsuspend" })}
                            title="Unsuspend"
                            aria-label={`Unsuspend ${u.name}`}
                            className={cn(ICON_BTN, "hover:bg-emerald-50 hover:text-emerald-600")}
                          >
                            <Play size={14} />
                          </button>
                        ) : u.role !== "super_admin" ? (
                          <button
                            type="button"
                            onClick={() => setSuspendTarget(u)}
                            title="Suspend"
                            aria-label={`Suspend ${u.name}`}
                            className={cn(ICON_BTN, "hover:bg-amber-50 hover:text-amber-600")}
                          >
                            <Pause size={14} />
                          </button>
                        ) : null}
                        {u.role !== "super_admin" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Delete ${u.name}? This cannot be undone.`)) remove.mutate(u.id);
                            }}
                            title="Delete"
                            aria-label={`Delete ${u.name}`}
                            className={cn(ICON_BTN, "hover:bg-red-50 hover:text-red-600")}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                        <Link href={`/admin/users/${u.id}`} className={ROW_LINK}>
                          Open
                          <ChevronRight size={13} className="transition-transform group-hover/v:translate-x-0.5" />
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {/* ── Role breakdown / filter ──────────────────────────────────── */}
        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Roles">
          <section className={PANEL} aria-labelledby="usr-roles">
            <PanelHeader
              id="usr-roles"
              icon={<Shield size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="By role"
              caption="Filter the directory"
            />
            {counts.total > 0 ? (
              <div className="mt-5 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                {roleList.map((r) => (
                  <span
                    key={r.role}
                    className={cn("h-full", ROLE_DOT[r.role] ?? "bg-slate-300")}
                    style={{ width: `${(r.count / counts.total) * 100}%` }}
                  />
                ))}
              </div>
            ) : null}
            <ul className="mt-4 flex flex-col gap-0.5">
              {[{ role: "all", count: counts.total }, ...roleList].map((r) => {
                const on = role === r.role;
                return (
                  <li key={r.role}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => setRole(r.role)}
                      className={cn(
                        "-mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                        on ? "bg-sky-50" : "hover:bg-slate-50",
                      )}
                    >
                      <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", r.role === "all" ? "bg-slate-900" : ROLE_DOT[r.role] ?? "bg-slate-300")} aria-hidden />
                      <span className={cn("min-w-0 flex-1 truncate text-[13px]", on ? "font-semibold text-sky-800" : "font-medium text-slate-700")}>
                        {r.role === "all" ? "All roles" : humanize(r.role)}
                      </span>
                      <span
                        className={cn(
                          "min-w-[28px] rounded-md px-1.5 py-0.5 text-center text-[11px] font-semibold tabular-nums",
                          on ? "bg-white text-sky-700" : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {r.count}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </aside>
      </div>

      <BulkActionBar
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        invalidateKeys={[adminQk.users(params)]}
      />

      <Modal open={!!suspendTarget} onClose={() => setSuspendTarget(null)} title={`Suspend ${suspendTarget?.name ?? ""}`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!suspendTarget) return;
            if (suspendReason.trim().length < 3) {
              toast.error("Reason required");
              return;
            }
            toggleSuspend.mutate({ id: suspendTarget.id, action: "suspend", reason: suspendReason.trim() });
          }}
        >
          <p className="text-sm text-text-soft">
            Suspended users are blocked from signing in. You can unsuspend them at any time.
          </p>
          <Field label="Reason" htmlFor="suspend-reason" required>
            <Input
              id="suspend-reason"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              maxLength={500}
              placeholder="e.g. Terms of service violation"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setSuspendTarget(null)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={toggleSuspend.isPending}>
              Suspend user
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!impersonateTarget}
        onClose={() => setImpersonateTarget(null)}
        title={`Impersonate ${impersonateTarget?.name ?? ""}`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setImpersonateTarget(null)}>Cancel</Button>
            <Button
              onClick={() => impersonateTarget && impersonate.mutate(impersonateTarget.id)}
              disabled={impersonate.isPending}
              className="bg-red-600 text-white"
            >
              {impersonate.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : null}
              Start session
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-text-soft">
            You will receive a short-lived impersonation token. Use it to view the app exactly as <b>{impersonateTarget?.name ?? ""}</b> sees it. Every action is audited with your admin ID and the impersonated subject.
          </p>
          <p className="text-sm text-text-soft">
            A passkey assertion is required before the session can begin.
          </p>
        </div>
      </Modal>
    </div>
  );
}

