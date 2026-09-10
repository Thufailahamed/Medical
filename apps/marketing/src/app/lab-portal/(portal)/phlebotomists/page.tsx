"use client";

import { useMemo, useState } from "react";
import {
  Users,
  Plus,
  Phone,
  Mail,
  Trash2,
  Search,
  CheckCircle2,
  XCircle,
  UserPlus,
  AlertTriangle,
  ShieldCheck,
  Award,
  Save,
} from "lucide-react";
import {
  usePhlebotomists,
  useCreatePhlebotomist,
  useDeletePhlebotomist,
} from "../../hooks/useApi";

export default function PhlebotomistsPage() {
  const { data, isLoading } = usePhlebotomists();
  const createPhleb = useCreatePhlebotomist();
  const deletePhleb = useDeletePhlebotomist();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(() => {
    const list = data?.phlebotomists ?? [];
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q)
    );
  }, [data, search]);

  const totals = useMemo(() => {
    const list = data?.phlebotomists ?? [];
    return {
      total: list.length,
      active: list.filter((p) => p.isActive).length,
      inactive: list.filter((p) => !p.isActive).length,
    };
  }, [data]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createPhleb.mutateAsync({
        name: form.name,
        phone: form.phone,
        email: form.email || undefined,
      });
      setShowForm(false);
      setForm({ name: "", phone: "", email: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="lab-page">
      {/* ── Page head ── */}
      <div className="lab-page-head">
        <div>
          <span className="lab-page-eyebrow">
            <Users size={10} />
            Field Operations
          </span>
          <h1 className="lab-page-title">
            Phlebotomy <strong>team</strong>
          </h1>
          <p className="lab-page-sub">
            Manage sample-collection technicians, credentials, and on-call
            dispatching for inbound requisitions.
          </p>
        </div>
        <div className="lab-page-actions">
          <button
            type="button"
            className="lab-btn lab-btn-primary"
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          >
            <Plus size={14} />
            Add phlebotomist
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div
          className="lab-stat"
          style={
            { "--lab-stat-accent": "#1D4ED8", "--lab-stat-soft": "#DBEAFE" } as React.CSSProperties
          }
        >
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><Users size={19} strokeWidth={2.1} /></div>
          </div>
          <div className="lab-stat-label">Team size</div>
          <div className="lab-stat-value mt-2">{totals.total}</div>
          <div className="lab-stat-foot">Registered staff</div>
        </div>
        <div
          className="lab-stat"
          style={
            { "--lab-stat-accent": "#059669", "--lab-stat-soft": "#D1FAE5" } as React.CSSProperties
          }
        >
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><CheckCircle2 size={19} strokeWidth={2.2} /></div>
          </div>
          <div className="lab-stat-label">Active</div>
          <div className="lab-stat-value mt-2">{totals.active}</div>
          <div className="lab-stat-foot">Eligible for dispatch</div>
        </div>
        <div
          className="lab-stat"
          style={
            { "--lab-stat-accent": "#D97706", "--lab-stat-soft": "#FEF3C7" } as React.CSSProperties
          }
        >
          <div className="lab-stat-row">
            <div className="lab-stat-icon"><XCircle size={19} strokeWidth={2.2} /></div>
          </div>
          <div className="lab-stat-label">Inactive</div>
          <div className="lab-stat-value mt-2">{totals.inactive}</div>
          <div className="lab-stat-foot">Off roster</div>
        </div>
      </section>

      {/* ── Inline add form ── */}
      {showForm && (
        <div className="lab-card mb-6 overflow-hidden">
          <div
            className="px-5 py-3.5 flex items-center justify-between border-b border-[var(--lab-border)]"
            style={{
              background:
                "linear-gradient(120deg, rgba(5,150,105,0.06) 0%, rgba(29,78,216,0.04) 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--lab-brand-soft)] text-[var(--lab-brand)] grid place-content-center">
                <UserPlus size={14} strokeWidth={2.2} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-[var(--lab-night)]">
                  Register new phlebotomist
                </div>
                <div className="text-[11.5px] text-[var(--lab-ink-soft)]">
                  They will be available for dispatch immediately.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="lab-modal-close"
              aria-label="Close"
              onClick={() => !submitting && setShowForm(false)}
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="lab-card-pad space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="lab-field">
                <label className="lab-label">
                  Full name <span className="lab-label-req">*</span>
                </label>
                <input
                  required
                  placeholder="e.g. Saman Perera"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="lab-input"
                />
              </div>
              <div className="lab-field">
                <label className="lab-label">
                  Phone <span className="lab-label-req">*</span>
                </label>
                <input
                  required
                  type="tel"
                  placeholder="+94 77 123 4567"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="lab-input lab-mono"
                />
              </div>
              <div className="lab-field">
                <label className="lab-label">Email</label>
                <input
                  type="email"
                  placeholder="saman@facility.lk"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="lab-input"
                />
              </div>
            </div>

            <div className="rounded-xl bg-[var(--lab-surface-2)] border border-[var(--lab-border)] px-4 py-3 flex items-start gap-3">
              <ShieldCheck size={16} className="text-[var(--lab-brand)] shrink-0 mt-0.5" />
              <div className="text-[12px] text-[var(--lab-ink-soft)] leading-relaxed">
                All phlebotomists are bound by your facility&rsquo;s MOH credentialing
                protocol. Cross-checks against the national registry run nightly.
              </div>
            </div>

            {error && (
              <div className="lab-banner lab-banner-danger">
                <div className="lab-banner-icon">
                  <AlertTriangle size={14} />
                </div>
                <div>{error}</div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-[var(--lab-border)]">
              <button
                type="button"
                className="lab-btn lab-btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="lab-btn lab-btn-primary"
                disabled={submitting}
              >
                <Save size={14} />
                {submitting ? "Saving…" : "Add to roster"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <div className="lab-section-title flex items-center gap-2">
          <Award size={14} className="text-[var(--lab-brand)]" />
          Roster
        </div>
        <div className="lab-topbar-search !max-w-[280px]">
          <Search size={14} className="lab-topbar-search-icon" />
          <input
            type="search"
            placeholder="Filter team members…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── List ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="lab-card lab-card-pad">
              <div className="flex items-center gap-3">
                <div className="lab-skel w-11 h-11 rounded-full" />
                <div className="flex-1">
                  <div className="lab-skel h-4 w-2/3 mb-2" />
                  <div className="lab-skel h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="lab-empty">
          <div className="lab-empty-icon">
            <Users size={26} strokeWidth={1.8} />
          </div>
          <div className="lab-empty-title">
            {search ? "No team members match" : "No phlebotomists yet"}
          </div>
          <p className="lab-empty-msg">
            {search
              ? `Nothing matches "${search}".`
              : "Add your first phlebotomist to start dispatching collection jobs."}
          </p>
          {!search && (
            <button
              type="button"
              className="lab-btn lab-btn-primary mt-5"
              onClick={() => setShowForm(true)}
            >
              <Plus size={14} />
              Add phlebotomist
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((phleb) => {
            const initials = phleb.name
              .split(/\s+/)
              .map((p) => p[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <article
                key={phleb.id}
                className="lab-card lab-card-pad flex items-center justify-between gap-4 group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white grid place-content-center font-bold text-[14px] tracking-tight shadow-[0_4px_12px_-4px_rgba(5,150,105,0.45)]">
                      {initials || "P"}
                    </div>
                    {phleb.isActive && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-white shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-[14.5px] font-bold text-[var(--lab-night)] tracking-tight truncate">
                        {phleb.name}
                      </h3>
                      <span
                        className="lab-pill"
                        data-status={phleb.isActive ? "active" : "inactive"}
                      >
                        {phleb.isActive ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-[var(--lab-ink-soft)]">
                      <span className="inline-flex items-center gap-1.5">
                        <Phone size={11} className="text-[var(--lab-ink-faint)]" />
                        <span className="lab-mono">{phleb.phone}</span>
                      </span>
                      {phleb.email && (
                        <span className="inline-flex items-center gap-1.5">
                          <Mail size={11} className="text-[var(--lab-ink-faint)]" />
                          {phleb.email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="lab-btn lab-btn-ghost lab-btn-sm !text-[var(--lab-danger)] hover:!bg-[var(--lab-danger-soft)] opacity-70 group-hover:opacity-100"
                  onClick={() => deletePhleb.mutate(phleb.id)}
                  aria-label={`Deactivate ${phleb.name}`}
                >
                  <Trash2 size={12} />
                  Deactivate
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
