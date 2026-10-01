"use client";

import { useMemo, useState } from "react";
import {
  Users,
  Plus,
  Phone,
  Mail,
  Trash2,
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
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_PRIMARY,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PanelSearch,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  HeroPulse,
  RailRow,
  Badge,
  PanelSkeleton,
} from "@/patient/components/workspace";

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
    <div className="lab-page flex flex-col gap-6">
      <DoctorHero
        kicker="Field operations"
        kickerIcon={<Users size={12} />}
        kickerMeta={`${totals.total} registered`}
        title="Phlebotomy team"
        description="Manage sample-collection technicians, credentials, and on-call dispatching for inbound requisitions."
        chips={
          <>
            <span className={HERO_CHIP}>
              <CheckCircle2 size={12} /> {totals.active} active
            </span>
            <span className={HERO_CHIP}>
              <XCircle size={12} /> {totals.inactive} off roster
            </span>
          </>
        }
        aside={
          <HeroPulse
            icon={<UserPlus size={18} />}
            label="Dispatch-ready"
            value={totals.active}
            sub="Eligible for collection jobs"
          />
        }
        actions={
          <button
            type="button"
            className={HERO_PRIMARY}
            onClick={() => {
              setError(null);
              setShowForm(true);
            }}
          >
            <Plus size={14} /> Add phlebotomist
          </button>
        }
      />

      <HeroOverlap>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <StatTile
            label="Team size"
            icon={<Users size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={String(totals.total)}
            sub="Registered staff"
          />
          <StatTile
            label="Active"
            icon={<CheckCircle2 size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={String(totals.active)}
            sub="Eligible for dispatch"
          />
          <StatTile
            label="Inactive"
            icon={<XCircle size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={String(totals.inactive)}
            sub="Off roster"
            pulse={totals.inactive > 0}
          />
        </div>
      </HeroOverlap>

      {/* ── Inline add form ── */}
      {showForm && (
        <section className={`${PANEL} overflow-hidden`}>
          <PanelHeader
            icon={<UserPlus size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            title="Register new phlebotomist"
            caption="They will be available for dispatch immediately."
            action={
              <button
                type="button"
                className="lab-modal-close"
                aria-label="Close"
                onClick={() => !submitting && setShowForm(false)}
              >
                ✕
              </button>
            }
          />
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
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

            <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <ShieldCheck size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              <div className="text-[12px] leading-relaxed text-slate-500">
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

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
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
        </section>
      )}

      <section className={PANEL}>
        <PanelHeader
          icon={<Award size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          title="Roster"
          caption={`${filtered.length} shown`}
          action={
            <PanelSearch
              value={search}
              onChange={setSearch}
              placeholder="Filter team members…"
              ariaLabel="Filter team members"
            />
          }
        />

        {isLoading ? (
          <PanelSkeleton rows={4} />
        ) : filtered.length === 0 ? (
          <EmptyBlock
            icon={<Users size={19} />}
            title={search ? "No team members match" : "No phlebotomists yet"}
            body={
              search
                ? `Nothing matches "${search}".`
                : "Add your first phlebotomist to start dispatching collection jobs."
            }
            actions={
              !search ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-4 text-xs font-semibold text-white transition-colors hover:bg-sky-800"
                  onClick={() => setShowForm(true)}
                >
                  <Plus size={14} /> Add phlebotomist
                </button>
              ) : undefined
            }
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {filtered.map((phleb) => {
              const initials = phleb.name
                .split(/\s+/)
                .map((p) => p[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <li key={phleb.id}>
                  <RailRow
                    tone={phleb.isActive ? "emerald" : "slate"}
                    active={phleb.isActive}
                    icon={
                      <div className="grid h-9 w-9 place-content-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-[12px] font-bold text-white shadow-sm">
                        {initials || "P"}
                      </div>
                    }
                    title={
                      <span className="flex items-center gap-2">
                        {phleb.name}
                        <Badge tone={phleb.isActive ? "emerald" : "slate"}>
                          {phleb.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </span>
                    }
                    meta={
                      <>
                        <span className="inline-flex items-center gap-1.5">
                          <Phone size={11} className="text-slate-400" />
                          <span className="font-mono">{phleb.phone}</span>
                        </span>
                        {phleb.email ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Mail size={11} className="text-slate-400" />
                            {phleb.email}
                          </span>
                        ) : null}
                      </>
                    }
                    trailing={
                      <button
                        type="button"
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50"
                        onClick={() => deletePhleb.mutate(phleb.id)}
                        aria-label={`Deactivate ${phleb.name}`}
                      >
                        <Trash2 size={12} />
                        Deactivate
                      </button>
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
