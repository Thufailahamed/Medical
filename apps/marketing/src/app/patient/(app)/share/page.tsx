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
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";
import { SegmentedTabs } from "@/patient/components/primitives/SegmentedTabs";

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
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<Share2 size={13} aria-hidden />}
        kicker="Encrypted Clinical Data Exchange"
        title="Secure Record Sharing & Visit Packs"
        description="Generate expiring, authenticated access links for external specialists, second opinions, or caregivers without compromising your account security."
        status={
          activeLinks.length > 0 ? (
            <HeroStatusPill label={`${activeLinks.length} active`} tone="success" />
          ) : (
            <HeroStatusPill label="No active links" tone="paper" />
          )
        }
        actions={
          <>
            <Link href="/patient/consents" className={heroSecondaryAction}>
              <ShieldCheck size={13} aria-hidden />
              Consents &amp; Approvals
            </Link>
            <Link href="/patient/export" className={heroPrimaryAction}>
              <FolderLock size={14} aria-hidden />
              Export Full EHR
            </Link>
          </>
        }
        footer={
          <>
            <span>Active Share Links · {activeLinks.length} Active</span>
            <span>Total Minted · {links.length} Links</span>
            <span>Security · Zero-Knowledge</span>
            <span>Revocation · Instant Killswitch</span>
          </>
        }
      />

      {/* ── 2. Create Share Link or Visit Pack ───────────────────────────────── */}
      <section className="rounded-xl border border-border bg-surface p-5 sm:p-6 shadow-card flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-border">
          <div>
            <h2 className="pt-kicker flex items-center gap-2">
              <Link2 size={16} className="text-brand" aria-hidden />
              <span>Create Access Link</span>
            </h2>
            <p className="text-xs text-text-soft mt-0.5">
              Choose between an all-records consultation pass or a curated visit pack.
            </p>
          </div>

          {/* Mode Switcher */}
          <SegmentedTabs
            ariaLabel="Share mode"
            activeId={activeMode}
            onChange={(id) => setActiveMode(id as "quick" | "pack")}
            tabs={[
              { id: "quick", label: <>Standard Visit Link (All)</> },
              {
                id: "pack",
                label: (
                  <>
                    <span>Custom Share Pack</span>
                    {packSelected.length > 0 ? (
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-sky-600 text-white">
                        {packSelected.length}
                      </span>
                    ) : null}
                  </>
                ),
              },
            ]}
          />
        </div>

        {activeMode === "quick" ? (
          /* Quick Visit Link Form */
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end pt-1">
            <div className="sm:col-span-6 flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Recipient / Purpose Label
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. For Dr. Perera's Cardiology Consult"
                className="pt-input text-xs sm:text-sm"
              />
            </div>

            <div className="sm:col-span-3 flex flex-col gap-1">
              <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                Access Duration
              </label>
              <select
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="pt-input text-xs sm:text-sm"
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
                className="pt-btn pt-btn-primary h-10 w-full text-xs disabled:opacity-50"
              >
                {create.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  <>
                    <Plus size={14} aria-hidden />
                    Generate Visit Link
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
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Pack Title
                </label>
                <input
                  value={packLabel}
                  onChange={(e) => setPackLabel(e.target.value)}
                  placeholder="e.g. Pre-Surgery Lab & ECG Bundle"
                  className="pt-input text-xs sm:text-sm"
                />
              </div>

              <div className="sm:col-span-3 flex flex-col gap-1">
                <label className="text-[11px] font-bold text-text-soft uppercase tracking-wider">
                  Pack Validity
                </label>
                <select
                  value={packHours}
                  onChange={(e) => setPackHours(e.target.value)}
                  className="pt-input text-xs sm:text-sm"
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
                className="pt-btn pt-btn-primary h-10 w-full text-xs disabled:opacity-50"
              >
                {createPack.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                    Packing…
                  </>
                ) : (
                  <>
                    <FolderLock size={14} aria-hidden />
                    Mint Pack ({packSelected.length})
                  </>
                )}
              </button>
              </div>
            </div>

            {/* Record Picker Header with Search */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-border flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text">
                  Select Records to Include
                </span>
                <span className="text-[11px] text-text-muted">
                  ({packSelected.length} of {packRecords.length} selected)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={selectAllRecords}
                  className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                >
                  {packSelected.length === filteredPackRecords.length
                    ? "Deselect All"
                    : "Select All"}
                </button>

                <div className="relative w-44 sm:w-56">
                  <Search
                    size={13}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
                    aria-hidden
                  />
                  <input
                    type="text"
                    value={recordSearch}
                    onChange={(e) => setRecordSearch(e.target.value)}
                    placeholder="Search records…"
                    className="pt-input pl-7 pr-2 !h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Record Picker List */}
            <div className="max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border bg-surface-2/50">
              {records.isLoading ? (
                <div className="p-4 text-xs text-text-muted text-center">Loading medical records…</div>
              ) : filteredPackRecords.length === 0 ? (
                <div className="p-4 text-xs text-text-muted text-center">
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
                        checked ? "bg-brand-soft/60" : "hover:bg-surface",
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
                        className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                      />

                      <div className="grid h-7 w-7 place-items-center rounded-md bg-surface-2 text-text-soft shrink-0" aria-hidden>
                        <Icon size={14} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-text truncate">
                          {r.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[11px] text-text-muted">
                        <span className="capitalize font-medium text-text-soft bg-surface-2 px-2 py-0.5 rounded-md">
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
          <h2 className="pt-kicker flex items-center gap-2">
            <Globe size={16} className="text-brand" aria-hidden />
            <span>Active &amp; Historical Share Links</span>
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal text-brand">
              {links.length}
            </span>
          </h2>
        </div>

        {list.isLoading ? (
          <div className="flex flex-col gap-2.5">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl bg-surface-2 animate-pulse border border-border"
              />
            ))}
          </div>
        ) : links.length === 0 ? (
          <div className="p-8 sm:p-10 rounded-xl bg-surface border border-border shadow-card flex flex-col items-center text-center gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-md bg-brand-soft text-brand shadow-2xs" aria-hidden>
              <Share2 size={28} />
            </div>
            <div className="max-w-md">
              <h3 className="t-card-title text-text">
                No Active Share Links Yet
              </h3>
              <p className="text-xs sm:text-sm text-text-soft mt-1 leading-relaxed">
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
                    "p-4 sm:p-5 rounded-xl bg-surface border shadow-card hover:shadow-md transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                    l.revoked || expired
                      ? "border-border bg-surface-2/40 opacity-75"
                      : "border-border hover:border-border-strong",
                  )}
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-md shrink-0 shadow-2xs",
                        l.revoked
                          ? "bg-danger-soft text-danger"
                          : expired
                            ? "bg-warn-soft text-warn"
                            : "bg-brand-soft text-brand",
                      )}
                      aria-hidden
                    >
                      <Share2 size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-text text-sm sm:text-base truncate">
                          {l.label || "Untitled Share Link"}
                        </h3>

                        {l.revoked ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-danger-soft text-danger">
                            Revoked
                          </span>
                        ) : expired ? (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-warn-soft text-warn">
                            Expired
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider bg-success-soft text-success">
                            Active
                          </span>
                        )}
                      </div>

                      {/* Link URL */}
                      <p className="text-xs text-text-soft font-mono mt-0.5 truncate max-w-md select-all">
                        {url}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-text-muted font-medium flex-wrap">
                        <span>Created {relativeTime(l.createdAt)}</span>
                        <span>·</span>
                        <span>
                          {expired ? "Expired" : "Expires"} {formatDateTime(l.expiresAt)}
                        </span>
                        {l.lastViewedAt ? (
                          <>
                            <span>·</span>
                            <span className="text-brand font-semibold">
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
                        className="pt-btn pt-btn-secondary h-8 px-3 text-xs"
                      >
                        {isCopied ? (
                          <>
                            <Check size={13} className="text-success" aria-hidden />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy size={13} aria-hidden />
                            Copy Link
                          </>
                        )}
                      </button>

                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
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
                        className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer"
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
      <section className="rounded-xl border border-border bg-surface p-5 shadow-card flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="grid h-11 w-11 place-items-center rounded-md bg-success-soft text-success shrink-0" aria-hidden>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4 className="t-card-title text-text">
              Zero-Knowledge Tokenized Security
            </h4>
            <p className="text-xs text-text-soft mt-0.5">
              Recipients only view the records permitted by your link. They cannot browse your other files or modify your account.
            </p>
          </div>
        </div>

        <Link
          href="/patient/consents"
          className="pt-btn pt-btn-secondary h-9 px-4 text-xs shrink-0"
        >
          <ExternalLink size={13} aria-hidden />
          Active Consents
        </Link>
      </section>
    </div>
  );
}
