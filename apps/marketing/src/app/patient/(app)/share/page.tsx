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
  Share2,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Trash2,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { formatDateTime, relativeTime } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";
import {
  EmptyBlock,
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  PatientHero,
  PatientPage,
  QuickToolsPanel,
  Segmented,
  StatTile,
} from "@/patient/components/workspace";

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
  const [now] = useState(() => Date.now());

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
  const packRecords = useMemo(() => records.data?.records ?? [], [records.data?.records]);

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

  const links = useMemo(() => list.data?.links ?? [], [list.data?.links]);
  const activeLinks = useMemo(
    () => links.filter((l) => !l.revoked && new Date(l.expiresAt).getTime() > now),
    [links, now],
  );
  const retiredCount = links.length - activeLinks.length;

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
    <PatientPage>
      <PatientHero
        kickerIcon={<Share2 size={13} aria-hidden />}
        kicker="Records"
        kickerMeta="Encrypted data exchange"
        title={
          <>
            Secure sharing <HeroAccent>&amp; visit packs</HeroAccent>
          </>
        }
        description="Generate expiring, authenticated access links for external specialists, second opinions, or caregivers — without compromising your account security."
        chips={
          <>
            <span className={HERO_CHIP}>
              <Link2 size={12} className="text-sky-300" />
              {activeLinks.length} active
            </span>
            <span className={HERO_CHIP}>{links.length} minted</span>
            <span className={HERO_CHIP}>
              <ShieldCheck size={12} className="text-emerald-300" />
              Zero-knowledge
            </span>
          </>
        }
        actions={
          <>
            <Link href="/patient/consents" className={HERO_GHOST}>
              <ShieldCheck size={13} /> Consents
            </Link>
            <Link href="/patient/export" className={HERO_PRIMARY}>
              <FolderLock size={14} className="text-sky-600" /> Export full EHR
            </Link>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Link2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Active links"
          value={String(activeLinks.length)}
          sub="Live access passes"
          pulse={activeLinks.length > 0}
        />
        <StatTile
          icon={<Globe size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Total minted"
          value={String(links.length)}
          sub="All-time share links"
        />
        <StatTile
          icon={<Trash2 size={16} />}
          tone="bg-rose-50 text-rose-600"
          label="Expired / revoked"
          value={String(retiredCount)}
          sub="Killswitch applied"
        />
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Consents"
          value="RBAC"
          sub="Granular grants"
          href="/patient/consents"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-8">
          <section className={PANEL}>
            <PanelHeader
              icon={<Link2 size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Create access link"
              caption="All-records consultation pass or a curated visit pack."
              action={
                <Segmented
                  ariaLabel="Share mode"
                  options={[
                    { value: "quick", label: "Standard (all)" },
                    {
                      value: "pack",
                      label: "Custom pack",
                      count: packSelected.length > 0 ? packSelected.length : undefined,
                    },
                  ]}
                  value={activeMode}
                  onChange={(v) => setActiveMode(v as "quick" | "pack")}
                />
              }
            />

            {activeMode === "quick" ? (
              <div className="mt-4 grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                <div className="sm:col-span-6">
                  <label className={FIELD_LABEL}>Recipient / purpose label</label>
                  <input
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. For Dr. Perera's Cardiology Consult"
                    className={FIELD_INPUT}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className={FIELD_LABEL}>Access duration</label>
                  <select
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className={FIELD_INPUT}
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
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {create.isPending ? (
                      <Loader2 size={14} className="animate-spin" aria-hidden />
                    ) : (
                      <Plus size={14} aria-hidden />
                    )}
                    {create.isPending ? "Generating…" : "Generate link"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-6">
                    <label className={FIELD_LABEL}>Pack title</label>
                    <input
                      value={packLabel}
                      onChange={(e) => setPackLabel(e.target.value)}
                      placeholder="e.g. Pre-Surgery Lab & ECG Bundle"
                      className={FIELD_INPUT}
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={FIELD_LABEL}>Pack validity</label>
                    <select
                      value={packHours}
                      onChange={(e) => setPackHours(e.target.value)}
                      className={FIELD_INPUT}
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
                      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                    >
                      {createPack.isPending ? (
                        <Loader2 size={14} className="animate-spin" aria-hidden />
                      ) : (
                        <FolderLock size={14} aria-hidden />
                      )}
                      {createPack.isPending ? "Packing…" : `Mint pack (${packSelected.length})`}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Select records to include
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({packSelected.length} of {packRecords.length} selected)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={selectAllRecords}
                      className="text-xs font-semibold text-sky-700 hover:underline"
                    >
                      {packSelected.length === filteredPackRecords.length
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                    <PanelSearch
                      value={recordSearch}
                      onChange={setRecordSearch}
                      placeholder="Search records…"
                      className="w-44 sm:w-56"
                    />
                  </div>
                </div>

                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/50">
                  {records.isLoading ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      Loading medical records…
                    </div>
                  ) : filteredPackRecords.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
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
                            "flex cursor-pointer select-none items-center gap-3 px-3.5 py-2.5 text-xs transition-colors",
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
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-sky-600"
                          />
                          <div
                            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500"
                            aria-hidden
                          >
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-semibold text-slate-900">{r.title}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-[11px] text-slate-400">
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium capitalize text-slate-500">
                              {(r.kind || r.recordType).replace(/_/g, " ")}
                            </span>
                            {r.date ? (
                              <span>{new Date(r.date).toLocaleDateString()}</span>
                            ) : null}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>

          <section className={PANEL}>
            <PanelHeader
              icon={<Globe size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Share links"
              caption={`${links.length} minted · ${activeLinks.length} live`}
            />
            {list.isLoading ? (
              <div className="mt-4 flex flex-col gap-2.5">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : links.length === 0 ? (
              <EmptyBlock
                icon={<Share2 size={19} />}
                title="No share links yet"
                body="Time-limited links for outside doctors or family appear here with live access auditing and instant revocation."
              />
            ) : (
              <ul className="mt-4 flex flex-col gap-2.5">
                {links.map((l) => {
                  const url =
                    typeof window !== "undefined"
                      ? `${window.location.origin}/share/${l.token}`
                      : `/share/${l.token}`;
                  const expired = new Date(l.expiresAt).getTime() < now;
                  const isCopied = copied === l.id;
                  const live = !l.revoked && !expired;

                  return (
                    <li
                      key={l.id}
                      className={cn(
                        "flex flex-col justify-between gap-4 rounded-2xl border bg-white p-4 transition-all sm:flex-row sm:items-center sm:p-5",
                        live
                          ? "border-slate-100 hover:border-slate-200 hover:shadow-md"
                          : "border-slate-100 bg-slate-50/50 opacity-75",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-3.5">
                        <div
                          className={cn(
                            "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
                            l.revoked
                              ? "bg-rose-50 text-rose-600"
                              : expired
                                ? "bg-amber-50 text-amber-600"
                                : "bg-emerald-50 text-emerald-600",
                          )}
                          aria-hidden
                        >
                          <Share2 size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-sm font-bold text-slate-900 sm:text-base">
                              {l.label || "Untitled share link"}
                            </h3>
                            <span
                              className={cn(
                                "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                                l.revoked
                                  ? "bg-rose-50 text-rose-700"
                                  : expired
                                    ? "bg-amber-50 text-amber-700"
                                    : "bg-emerald-50 text-emerald-700",
                              )}
                            >
                              {l.revoked ? "Revoked" : expired ? "Expired" : "Active"}
                            </span>
                          </div>
                          <p className="mt-0.5 max-w-md select-all truncate font-mono text-xs text-slate-500">
                            {url}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-400">
                            <span>Created {relativeTime(l.createdAt)}</span>
                            <span>·</span>
                            <span>
                              {expired ? "Expired" : "Expires"} {formatDateTime(l.expiresAt)}
                            </span>
                            <span>·</span>
                            {l.lastViewedAt ? (
                              <span className="font-semibold text-sky-700">
                                Last viewed {relativeTime(l.lastViewedAt)}
                              </span>
                            ) : (
                              <span>Not yet opened</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {live ? (
                        <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(url).catch(() => {});
                              setCopied(l.id);
                              setTimeout(() => setCopied(null), 2500);
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
                          >
                            {isCopied ? (
                              <>
                                <Check size={13} className="text-emerald-600" aria-hidden />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy size={13} aria-hidden />
                                Copy link
                              </>
                            )}
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                            title="Open share preview"
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
                            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                            title="Revoke link"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Zero-knowledge security"
              caption="What recipients can and can't do."
            />
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Recipients only view the records permitted by your link. They cannot
              browse your other files or modify your account — and links expire or
              can be revoked instantly.
            </p>
            <Link
              href="/patient/consents"
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
            >
              <ExternalLink size={13} /> Active consents
            </Link>
          </section>

          <QuickToolsPanel
            id="share-tools"
            title="Tools"
            tools={[
              {
                icon: FileText,
                label: "Records",
                hint: "Documents",
                href: "/patient/records",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: ShieldCheck,
                label: "Consents",
                hint: "Grants",
                href: "/patient/consents",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: FolderLock,
                label: "Export data",
                hint: "Full EHR",
                href: "/patient/export",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
            ]}
          />
        </aside>
      </div>
    </PatientPage>
  );
}
