"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  FileText,
  FlaskConical,
  FolderLock,
  Globe,
  Link2,
  Loader2,
  Lock,
  Pill,
  Plus,
  Search,
  Share2,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Trash2,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDateTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface ShareLink {
  id: string;
  token: string;
  label: string | null;
  scope: string;
  expiresAt: string;
  revoked: boolean;
  createdAt: string;
  lastViewedAt: string | null;
}

const EXPIRY_OPTIONS = [
  { value: "1", label: "1 Hour (Immediate Consult)" },
  { value: "24", label: "24 Hours (Standard Visit)" },
  { value: "168", label: "7 Days (Care Episode)" },
  { value: "720", label: "30 Days (Extended Review)" },
];

function getRecordIcon(kind?: string | null, recordType?: string) {
  const k = (kind || recordType || "").toLowerCase();
  if (k.includes("prescription") || k.includes("medication")) return Pill;
  if (k.includes("lab") || k.includes("test")) return FlaskConical;
  if (k.includes("vaccin")) return Syringe;
  if (k.includes("visit") || k.includes("consult")) return Stethoscope;
  return FileText;
}

export default function PatientSharePage() {
  const qc = useQueryClient();

  const [activeMode, setActiveMode] = useState<"quick" | "pack">("quick");
  const [hours, setHours] = useState("24");
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  // Custom Record Pack State
  const [packLabel, setPackLabel] = useState("");
  const [packHours, setPackHours] = useState("168");
  const [packSelected, setPackSelected] = useState<string[]>([]);
  const [recordSearch, setRecordSearch] = useState("");

  const records = useQuery({
    queryKey: ["patient", "me", "records", "for-pack", { limit: 100 }],
    queryFn: () =>
      api<{
        records: {
          id: string;
          title: string;
          kind: string | null;
          recordType: string;
          date: string | null;
        }[];
      }>("/medical-records/me?limit=100"),
  });
  const packRecords = records.data?.records ?? [];

  const filteredPackRecords = useMemo(() => {
    if (!recordSearch.trim()) return packRecords;
    const q = recordSearch.toLowerCase();
    return packRecords.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.kind || "").toLowerCase().includes(q) ||
        (r.recordType || "").toLowerCase().includes(q),
    );
  }, [packRecords, recordSearch]);

  const list = useQuery({
    queryKey: ["share", "links"],
    queryFn: () => api<{ links: ShareLink[] }>("/share/links"),
  });

  const links = list.data?.links ?? [];
  const activeLinks = useMemo(
    () =>
      links.filter(
        (l) => !l.revoked && new Date(l.expiresAt).getTime() > Date.now(),
      ),
    [links],
  );

  const create = useMutation({
    mutationFn: () =>
      api<{ link: ShareLink; url: string; expiresAt: string }>("/share/links", {
        method: "POST",
        json: {
          expiresInHours: Number(hours),
          label: label.trim() || undefined,
          scope: "all",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", "links"] });
      setLabel("");
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/share/links/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", "links"] });
    },
  });

  const createPack = useMutation({
    mutationFn: () =>
      api<{ link: ShareLink; url: string; expiresAt: string }>("/share/links", {
        method: "POST",
        json: {
          expiresInHours: Number(packHours),
          label: packLabel.trim() || undefined,
          recordIds: packSelected,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["share", "links"] });
      setPackSelected([]);
      setPackLabel("");
      setActiveMode("quick");
    },
  });

  const selectAllRecords = () => {
    if (packSelected.length === filteredPackRecords.length) {
      setPackSelected([]);
    } else {
      setPackSelected(filteredPackRecords.slice(0, 50).map((r) => r.id));
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Oceanic Signature Hero Header ───────────────────────────────── */}
      <header
        className="dashboard-hero relative rounded-2xl p-6 md:p-7 text-white overflow-hidden shadow-xl"
        style={{
          background:
            "linear-gradient(135deg, #0C4A6E 0%, #0369A1 40%, #0E7490 70%, #0C8B8C 100%)",
          boxShadow:
            "0 12px 36px rgba(3, 105, 161, 0.25), 0 2px 8px rgba(14, 116, 144, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.15)",
        }}
      >
        {/* Glow Orbs */}
        <div
          className="pointer-events-none absolute -top-16 -right-16 w-64 h-64 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(56,189,248,0.35) 0%, transparent 65%)",
          }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 -left-10 w-56 h-56 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(52,211,153,0.25) 0%, transparent 60%)",
          }}
          aria-hidden
        />

        <div className="relative z-10 flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider uppercase bg-white/15 border border-white/20 text-sky-200 backdrop-blur-md mb-2">
                <Share2 size={12} className="text-sky-300" />
                Encrypted Clinical Data Exchange
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Secure Record Sharing &amp; Visit Packs
              </h1>
              <p className="text-sm text-white/80 mt-1 leading-relaxed">
                Generate expiring, authenticated access links for external specialists, second opinions, or caregivers without compromising your account security.
              </p>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <Link
                href="/patient/consents"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-white/15 hover:bg-white/25 border border-white/25 transition-all backdrop-blur-md hover:scale-[1.02]"
              >
                <ShieldCheck size={13} />
                <span>Consents &amp; Approvals</span>
              </Link>
              <Link
                href="/patient/export"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-sky-950 bg-white hover:bg-sky-50 transition-all shadow-md hover:scale-[1.02]"
              >
                <FolderLock size={14} className="text-sky-700" />
                <span>Export Full EHR</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3.5 border-t border-white/15 text-white">
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200 shrink-0">
                <Link2 size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Active Share Links
                </p>
                <p className="text-base font-extrabold text-white">
                  {activeLinks.length} Active
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center text-white shrink-0">
                <Globe size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Total Minted
                </p>
                <p className="text-base font-extrabold text-white">
                  {links.length} Links
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-sky-400/30 flex items-center justify-center text-sky-200 shrink-0">
                <Lock size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Security
                </p>
                <p className="text-base font-extrabold text-white">Zero-Knowledge</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white/10 border border-white/10">
              <div className="h-8 w-8 rounded-lg bg-purple-400/30 flex items-center justify-center text-purple-200 shrink-0">
                <ShieldCheck size={16} />
              </div>
              <div className="min-w-0">
                <p className="text-[10.5px] uppercase font-bold text-sky-200 truncate">
                  Revocation
                </p>
                <p className="text-base font-extrabold text-white">Instant Killswitch</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. Create Share Link or Visit Pack ───────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-xs flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Link2 size={16} className="text-sky-600" />
              <span>Create Access Link</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose between an all-records consultation pass or a curated visit pack.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveMode("quick")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                activeMode === "quick"
                  ? "bg-white text-sky-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              Standard Visit Link (All)
            </button>
            <button
              type="button"
              onClick={() => setActiveMode("pack")}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeMode === "pack"
                  ? "bg-white text-sky-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900",
              )}
            >
              <span>Custom Share Pack</span>
              {packSelected.length > 0 ? (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-600 text-white">
                  {packSelected.length}
                </span>
              ) : null}
            </button>
          </div>
        </div>

        {activeMode === "quick" ? (
          /* Quick Visit Link Form */
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
            <div className="sm:col-span-6 flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Recipient / Purpose Label
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. For Dr. Perera's Cardiology Consult"
                className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
              />
            </div>

            <div className="sm:col-span-3 flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Access Duration
              </label>
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
              >
                {EXPIRY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={() => create.mutate()}
                disabled={create.isPending}
                className="w-full h-10 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                {create.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Generating…</span>
                  </>
                ) : (
                  <>
                    <Plus size={14} />
                    <span>Generate Visit Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Custom Share Pack Form */
          <div className="flex flex-col gap-4 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Pack Title
                </label>
                <input
                  value={packLabel}
                  onChange={(e) => setPackLabel(e.target.value)}
                  placeholder="e.g. Pre-Surgery Lab & ECG Bundle"
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
                />
              </div>

              <div className="sm:col-span-3 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Pack Validity
                </label>
                <select
                  value={packHours}
                  onChange={(e) => setPackHours(e.target.value)}
                  className="w-full h-10 px-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all cursor-pointer"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={() => createPack.mutate()}
                  disabled={createPack.isPending || packSelected.length === 0}
                  className="w-full h-10 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  style={{
                    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                  }}
                >
                  {createPack.isPending ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>Packing…</span>
                    </>
                  ) : (
                    <>
                      <FolderLock size={14} />
                      <span>Mint Pack ({packSelected.length})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Record Picker Header with Search */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  Select Records to Include
                </span>
                <span className="text-[11px] text-slate-400">
                  ({packSelected.length} of {packRecords.length} selected)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllRecords}
                  className="text-xs font-semibold text-sky-700 hover:underline cursor-pointer"
                >
                  {packSelected.length === filteredPackRecords.length
                    ? "Deselect All"
                    : "Select All"}
                </button>

                <div className="relative w-44 sm:w-56">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    type="text"
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    placeholder="Search records…"
                    className="w-full h-7 pl-7 pr-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Record Picker List */}
            <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-slate-50/50">
              {records.isLoading ? (
                <div className="p-4 text-xs text-slate-400 text-center">Loading medical records…</div>
              ) : filteredPackRecords.length === 0 ? (
                <div className="p-4 text-xs text-slate-400 text-center">
                  No records match your search filter.
                </div>
              ) : (
                filteredPackRecords.map((r) => {
                  const checked = packSelected.includes(r.id);
                  const Icon = getRecordIcon(r.kind, r.recordType);

                  return (
                    <label
                      key={r.id}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-2.5 text-xs transition-colors cursor-pointer select-none",
                        checked ? "bg-sky-50/70" : "hover:bg-white",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          setPackSelected((prev) =>
                            e.target.checked
                              ? prev.length < 50
                                ? [...prev, r.id]
                                : prev
                              : prev.filter((x) => x !== r.id),
                          );
                        }}
                        className="h-4 w-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300 cursor-pointer"
                      />

                      <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Icon size={14} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {r.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
                        <span className="capitalize font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                          {(r.kind || r.recordType).replace(/_/g, " ")}
                        </span>
                        {r.date ? <span>{new Date(r.date).toLocaleDateString()}</span> : null}
                      </div>
                    </label>
                  );
                })
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── 3. Active & Existing Share Links Feed ───────────────────────────── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
            <Globe size={16} className="text-sky-600" />
            <span>Active &amp; Historical Share Links</span>
            <span className="text-xs font-bold text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200/60">
              {links.length}
            </span>
          </h2>
        </div>

        {list.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-2xl bg-slate-100 animate-pulse border border-slate-200"
              />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-2xl bg-white border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shadow-2xs">
              <Share2 size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="text-base font-bold text-slate-900">
                No Active Share Links Yet
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
                When you generate time-limited links for outside doctors or family members, they will appear here with live access auditing and instant killswitch controls.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {links.map((l) => {
              const url =
                typeof window !== "undefined"
                  ? `${window.location.origin}/share/${l.token}`
                  : `/share/${l.token}`;
              const expired = new Date(l.expiresAt).getTime() < Date.now();
              const isCopied = copied === l.id;

              return (
                <article
                  key={l.id}
                  className={cn(
                    "p-4 sm:p-5 rounded-2xl bg-white border shadow-xs hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                    l.revoked || expired
                      ? "border-slate-200 bg-slate-50/40 opacity-75"
                      : "border-slate-200/90 hover:border-sky-300",
                  )}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs",
                        l.revoked
                          ? "bg-rose-50 text-rose-600 border border-rose-200"
                          : expired
                            ? "bg-amber-50 text-amber-600 border border-amber-200"
                            : "bg-sky-50 text-sky-700 border border-sky-200",
                      )}
                    >
                      <Share2 size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">
                          {l.label || "Untitled Share Link"}
                        </h3>

                        {l.revoked ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Revoked
                          </span>
                        ) : expired ? (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Expired
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Link URL */}
                      <p className="text-xs text-slate-500 font-mono mt-0.5 truncate max-w-md select-all">
                        {url}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-400 font-medium flex-wrap">
                        <span>Created {relativeTime(l.createdAt)}</span>
                        <span>·</span>
                        <span>
                          {expired ? "Expired" : "Expires"} {formatDateTime(l.expiresAt)}
                        </span>
                        {l.lastViewedAt ? (
                          <>
                            <span>·</span>
                            <span className="text-sky-700 font-semibold">
                              Last viewed {relativeTime(l.lastViewedAt)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span>·</span>
                            <span>Not yet opened</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!l.revoked && !expired && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={async () => {
                          await navigator.clipboard.writeText(url).catch(() => {});
                          setCopied(l.id);
                          setTimeout(() => setCopied(null), 2500);
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200/80 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        {isCopied ? (
                          <>
                            <Check size={13} className="text-emerald-600" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title="Open Share Preview"
                      >
                        <ExternalLink size={15} />
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Immediately revoke this share link?")) {
                            revoke.mutate(l.id);
                          }
                        }}
                        className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Revoke Link"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* ── 4. Privacy & Access Security Callout ────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="h-11 w-11 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Zero-Knowledge Tokenized Security
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">
              Recipients only view the records permitted by your link. They cannot browse your other files or modify your account.
            </p>
          </div>
        </div>

        <Link
          href="/patient/consents"
          className="px-4 py-2 rounded-xl text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shrink-0 flex items-center gap-1.5"
        >
          <ExternalLink size={13} className="text-emerald-700" />
          <span>Active Consents</span>
        </Link>
      </section>
    </div>
  );
}
