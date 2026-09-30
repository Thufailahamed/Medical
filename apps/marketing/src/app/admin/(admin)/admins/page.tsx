"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import {
  KeyRound,
  Loader2,
  LogIn,
  Mail,
  ScrollText,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  UserCog,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { DoctorHero, HERO_CHIP, HERO_GHOST, HERO_PRIMARY, StatTile } from "@/portal/components/doctor/Workspace";
import {
  AdminDirectory,
  ROW_BTN_DANGER,
  ROW_BTN_QUIET,
  humanize,
  statusRail,
  statusTone,
  withinDays,
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";
import { Modal } from "@/portal/components/ui/Modal";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { getPasskey } from "@/portal/lib/webauthn";
import { setStepUpToken } from "@/portal/lib/admin-api";

interface AdminRow {
  id: string;
  name: string | null;
  email: string | null;
  status: string | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  auditCountLast30d: number;
}

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

type Filter = "all" | "active" | "suspended";

export default function AdminAdminsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: adminQk.admins(),
    queryFn: () => adminApi<{ items: AdminRow[]; total: number }>("/admin/admins"),
  });

  const [promoteOpen, setPromoteOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [actionFor, setActionFor] = useState<AdminRow | null>(null);
  const [actionKind, setActionKind] = useState<"demote" | "suspend" | "unsuspend" | null>(null);
  const [reason, setReason] = useState("");

  const mut = useMutation({
    mutationFn: async (input: { kind: "demote" | "suspend" | "unsuspend"; body: Record<string, unknown> }) =>
      adminApiWithStepUp<{ ok: boolean }>(`/admin/admins/${input.kind}`, {
        method: "POST",
        json: input.body,
      }, refreshStepUp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQk.admins() });
      setActionFor(null);
      setActionKind(null);
      setReason("");
    },
  });

  const promote = useMutation({
    mutationFn: async (body: { userId: string; reason: string }) =>
      adminApiWithStepUp<{ ok: boolean }>("/admin/admins/promote", {
        method: "POST",
        json: body,
      }, refreshStepUp),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQk.admins() });
      setPromoteOpen(false);
    },
  });

  const items = data?.items ?? [];
  const [now] = useState(() => Date.now());
  const activeCount = items.filter((a) => a.status === "active").length;
  const suspendedCount = items.filter((a) => a.status === "suspended").length;
  const recentLogin = items.filter((a) => withinDays(a.lastLoginAt, 7, now)).length;
  const auditTotal = items.reduce((acc, a) => acc + (a.auditCountLast30d ?? 0), 0);
  const maxAudit = Math.max(1, ...items.map((a) => a.auditCountLast30d ?? 0));
  const filtered = items.filter((a) =>
    filter === "active" ? a.status === "active" : filter === "suspended" ? a.status === "suspended" : true,
  );

  const rows: DirectoryRow[] = filtered.map((a) => ({
    id: a.id,
    name: a.name ?? a.email ?? "Unnamed admin",
    accent: statusRail(a.status),
    leading: (
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm shadow-slate-900/30">
        <UserCog size={17} />
      </span>
    ),
    badges: (
      <>
        <Pill tone={statusTone(a.status)}>{humanize(a.status ?? "unknown")}</Pill>
        {withinDays(a.lastLoginAt, 1, now) ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Online today
          </span>
        ) : null}
      </>
    ),
    meta: [
      ...(a.email ? [{ icon: <Mail size={11} />, text: a.email }] : []),
      {
        icon: <LogIn size={11} />,
        text: a.lastLoginAt ? `Last login ${new Date(a.lastLoginAt).toLocaleString()}` : "Never signed in",
        wide: true,
      },
    ],
    searchText: a.email ?? "",
    actions: (
      <>
        <span className="hidden w-28 flex-col gap-1 md:flex" title={`${a.auditCountLast30d} audited actions in 30 days`}>
          <span className="flex items-center justify-between text-[10.5px] font-medium text-slate-400">
            <span>Audit 30d</span>
            <span className="font-semibold tabular-nums text-slate-600">{a.auditCountLast30d}</span>
          </span>
          <span className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-400"
              style={{ width: `${(a.auditCountLast30d / maxAudit) * 100}%` }}
            />
          </span>
        </span>
        {a.status === "suspended" ? (
          <button type="button" onClick={() => { setActionFor(a); setActionKind("unsuspend"); }} className={ROW_BTN_QUIET}>
            <ShieldCheck size={13} />
            Unsuspend
          </button>
        ) : (
          <button type="button" onClick={() => { setActionFor(a); setActionKind("suspend"); }} className={ROW_BTN_QUIET}>
            <ShieldOff size={13} />
            Suspend
          </button>
        )}
        <button type="button" onClick={() => { setActionFor(a); setActionKind("demote"); }} className={ROW_BTN_DANGER}>
          <UserMinus size={13} />
          Demote
        </button>
      </>
    ),
  }));

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<UserCog size={13} aria-hidden />}
          kicker="Super admins"
          kickerMeta={`${items.length} account${items.length === 1 ? "" : "s"}`}
          title={
            <>
              Platform{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                administrators
              </span>
            </>
          }
          description="Promote, demote and suspend super_admin accounts. Every destructive action requires a passkey and is written to the audit log."
          chips={
            <>
              <span className={HERO_CHIP}>
                <KeyRound size={12} className="text-emerald-300" aria-hidden />
                Passkey step-up required
              </span>
              <span className={HERO_CHIP}>
                <ScrollText size={12} className="text-sky-300" aria-hidden />
                {auditTotal.toLocaleString()} audited actions · 30d
              </span>
            </>
          }
          actions={
            <>
              <Link href="/admin/audit" className={HERO_GHOST}>
                <ScrollText size={15} aria-hidden />
                Audit log
              </Link>
              <button type="button" onClick={() => setPromoteOpen(true)} className={HERO_PRIMARY}>
                <UserPlus size={15} className="text-sky-600" aria-hidden />
                Promote user
              </button>
            </>
          }
        />
      }
      stats={
        <>
          <StatTile label="Administrators" icon={<UserCog size={16} />} tone="bg-slate-100 text-slate-700" value={isLoading ? "…" : String(items.length)} sub="super_admin accounts" active={filter === "all"} onClick={() => setFilter("all")} />
          <StatTile label="Active" icon={<ShieldCheck size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(activeCount)} sub="Can sign in" progress={items.length ? Math.round((activeCount / items.length) * 100) : null} active={filter === "active"} onClick={() => setFilter("active")} />
          <StatTile label="Suspended" icon={<ShieldOff size={16} />} tone="bg-red-50 text-red-600" value={String(suspendedCount)} sub={suspendedCount ? "Access revoked" : "None suspended"} active={filter === "suspended"} onClick={() => setFilter("suspended")} />
          <StatTile label="Signed in · 7 days" icon={<LogIn size={16} />} tone="bg-sky-50 text-sky-600" value={String(recentLogin)} unit={items.length ? `/ ${items.length}` : undefined} sub="Recently active admins" />
        </>
      }
      title="Administrator accounts"
      icon={<UserCog size={16} />}
      tone="bg-slate-100 text-slate-700"
      rows={rows}
      total={items.length}
      loading={isLoading}
      searchPlaceholder="Search name or email…"
      segmented={{
        value: filter,
        onChange: setFilter,
        options: [
          { value: "all", label: "All", count: items.length },
          { value: "active", label: "Active", count: activeCount },
          { value: "suspended", label: "Suspended", count: suspendedCount },
        ],
      }}
      empty={{ icon: <UserCog size={19} />, title: "No administrators", body: "Promote an existing user to give them super_admin access." }}
    >
      <Modal
        open={!!actionFor && !!actionKind}
        onClose={() => { setActionFor(null); setActionKind(null); }}
        title={actionKind ? `${humanize(actionKind)} administrator` : ""}
        subtitle={actionFor?.name ?? actionFor?.email ?? undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => { setActionFor(null); setActionKind(null); }}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!actionFor || !actionKind) return;
                mut.mutate({
                  kind: actionKind,
                  body: { userId: actionFor.id, reason: reason.trim() || "(no reason provided)" },
                });
              }}
              disabled={mut.isPending}
              className={
                actionKind === "unsuspend"
                  ? "inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  : "inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              }
            >
              {mut.isPending ? <Loader2 size={13} className="animate-spin" /> : <KeyRound size={13} />}
              Confirm with passkey
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div
            className={
              actionKind === "unsuspend"
                ? "flex items-start gap-3 rounded-xl bg-emerald-50/70 p-3.5 ring-1 ring-inset ring-emerald-600/10"
                : "flex items-start gap-3 rounded-xl bg-red-50/70 p-3.5 ring-1 ring-inset ring-red-600/10"
            }
          >
            <span
              className={
                actionKind === "unsuspend"
                  ? "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-emerald-500 text-white"
                  : "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-red-500 text-white"
              }
            >
              {actionKind === "demote" ? <UserMinus size={15} /> : actionKind === "suspend" ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
            </span>
            <p className="text-xs leading-relaxed text-slate-700">
              {actionKind === "demote"
                ? "They lose super admin access immediately and are moved to the patient role."
                : actionKind === "suspend"
                  ? "They won't be able to sign in until an admin reactivates the account."
                  : "They regain sign-in access with their existing super admin role."}{" "}
              This action is written to the audit log.
            </p>
          </div>
          <div>
            <label htmlFor="admin-action-reason" className="text-[13px] font-semibold text-slate-900">Reason</label>
            <textarea
              id="admin-action-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 h-20 w-full resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7]"
              placeholder="e.g. Left the operations team"
            />
          </div>
        </div>
      </Modal>

      <PromoteModal
        open={promoteOpen}
        onClose={() => setPromoteOpen(false)}
        onSubmit={(userId, reason) => promote.mutate({ userId, reason })}
        isPending={promote.isPending}
      />
    </AdminDirectory>
  );
}

const PROMOTE_REASONS = [
  "Joining the platform operations team",
  "On-call admin coverage",
  "Compliance & audit responsibilities",
];

function PromoteModal({ open, onClose, onSubmit, isPending }: {
  open: boolean;
  onClose: () => void;
  onSubmit: (userId: string, reason: string) => void;
  isPending: boolean;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<{ id: string; name: string; email: string; role: string } | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(id);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin", "promote-search", debounced],
    queryFn: () => adminApi<{ items: Array<{ id: string; name: string; email: string; role: string }> }>(
      `/admin/users?q=${encodeURIComponent(debounced)}&limit=10`,
    ),
    enabled: open && debounced.length >= 2 && !picked,
  });
  const results = (data?.items ?? []).filter((u) => u.role !== "super_admin");

  const close = () => {
    setQuery("");
    setDebounced("");
    setPicked(null);
    setReason("");
    onClose();
  };
  const canSubmit = !!picked && reason.trim().length >= 3 && !isPending;

  return (
    <Modal
      open={open}
      onClose={close}
      title="Promote to super admin"
      subtitle="Grants full, unrestricted access to the admin console"
      size="md"
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
            <KeyRound size={12} aria-hidden />
            Passkey confirmation required
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={close} className="inline-flex h-9 items-center rounded-lg px-3.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => picked && onSubmit(picked.id, reason.trim())}
              disabled={!canSubmit}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <ShieldCheck size={13} />}
              Promote
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-xl bg-gradient-to-br from-amber-50 to-white p-3.5 ring-1 ring-inset ring-amber-600/15">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-amber-500 text-white shadow-sm shadow-amber-500/30">
            <ShieldAlert size={15} aria-hidden />
          </span>
          <p className="text-xs leading-relaxed text-amber-900">
            Super admins can approve providers, impersonate users, move money and change any account. Only promote people who need it — the change is written to the audit log.
          </p>
        </div>

        {/* Step 1 — pick a user */}
        <div>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">1</span>
            Choose a user
          </p>
          {picked ? (
            <div className="mt-2.5 flex items-center gap-3 rounded-xl bg-sky-50/70 p-3 shadow-[inset_0_0_0_1.5px_rgba(2,132,199,0.35)]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-sm font-semibold text-white">
                {picked.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{picked.name}</p>
                <p className="truncate text-xs text-slate-500">
                  {picked.email} · <span className="font-medium">{humanize(picked.role)}</span>
                  <span className="text-sky-700"> → Super admin</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-semibold text-sky-700 hover:bg-white"
              >
                Change
              </button>
            </div>
          ) : (
            <>
              <div className="relative mt-2.5">
                <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="h-10 w-full rounded-xl bg-slate-50 pl-10 pr-9 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7,0_0_0_4px_rgba(14,165,233,0.12)]"
                  placeholder="Search by name or email…"
                  aria-label="Search users"
                  autoFocus
                />
                {isFetching ? (
                  <Loader2 size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-sky-600" aria-hidden />
                ) : null}
              </div>
              {debounced.length >= 2 ? (
                results.length > 0 ? (
                  <ul className="mt-2 flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {results.map((u) => (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPicked(u);
                            if (!reason) setReason("");
                          }}
                          className="group flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-slate-50"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                            {u.name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-slate-900 group-hover:text-sky-700">{u.name}</span>
                            <span className="block truncate text-xs text-slate-400">{u.email}</span>
                          </span>
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-semibold text-slate-600">
                            {humanize(u.role)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : !isFetching ? (
                  <p className="mt-2 rounded-xl bg-slate-50 px-4 py-4 text-center text-xs text-slate-400">No non-admin users match “{debounced}”.</p>
                ) : null
              ) : (
                <p className="mt-2 text-[11px] text-slate-400">Type at least 2 characters.</p>
              )}
            </>
          )}
        </div>

        {/* Step 2 — reason */}
        <div className={picked ? undefined : "pointer-events-none opacity-50"}>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-900">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-900 text-[10px] font-bold text-white">2</span>
            Reason for the audit log
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {PROMOTE_REASONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setReason(r)}
                className={
                  reason === r
                    ? "rounded-full bg-sky-600 px-2.5 py-1 text-[11px] font-semibold text-white"
                    : "rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200"
                }
              >
                {r}
              </button>
            ))}
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-2 h-20 w-full resize-none rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-900 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07)] outline-none placeholder:text-slate-400 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_#0284c7]"
            placeholder="Why does this person need super admin access?"
            aria-label="Reason"
          />
          <p className="mt-1 text-[11px] text-slate-400">{reason.trim().length < 3 ? "At least 3 characters" : "Looks good"}</p>
        </div>
      </div>
    </Modal>
  );
}
