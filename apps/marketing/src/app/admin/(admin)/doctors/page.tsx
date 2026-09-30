"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Clock,
  FileText,
  Hash,
  Mail,
  ShieldCheck,
  ShieldOff,
  Star,
  Stethoscope,
  Users,
} from "lucide-react";
import { Pill } from "@/portal/components/ui/Pill";
import { Drawer } from "@/portal/components/ui/Modal";
import { SlmcDocsPanel } from "@/portal/components/admin/SlmcDocsPanel";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";
import { DoctorHero, HERO_CHIP, StatTile } from "@/portal/components/doctor/Workspace";
import {
  AdminDirectory,
  ROW_BTN_APPROVE,
  ROW_BTN_DANGER,
  humanize,
  statusTone,
  type DirectoryRow,
} from "@/portal/components/admin/AdminDirectory";

type Row = {
  doctorId: string;
  userId: string;
  name: string;
  email: string | null;
  status: string;
  specialization: string | null;
  slmcRegistrationNo: string | null;
  slmcVerifiedAt: string | null;
  hospitalId: string | null;
  rating: number | null;
  experience: number | null;
};

type Filter = "all" | "verified" | "unverified";

function parseFilter(v: string | null): Filter {
  return v === "verified" || v === "unverified" ? v : "all";
}

export default function AdminDoctorsPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const slmcParam = params.get("slmc");
  const [slmc, setSlmc] = useState<Filter>(parseFilter(slmcParam));
  const [lastParam, setLastParam] = useState(slmcParam);
  const [openDoctor, setOpenDoctor] = useState<Row | null>(null);

  // Follow ?slmc= when the URL changes (e.g. the dashboard's "awaiting SLMC" link).
  if (slmcParam !== lastParam) {
    setLastParam(slmcParam);
    setSlmc(parseFilter(slmcParam));
  }

  const { data, isLoading } = useQuery({
    queryKey: adminQk.doctors({ slmc: "all" }),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/doctors?slmc=all&limit=200`),
  });

  const verify = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "verify-slmc" | "revoke-slmc" }) =>
      adminApiWithStepUp(`/admin/doctors/${id}/${action}`, { method: "POST", json: {} }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "verify-slmc" ? "SLMC verified" : "SLMC revoked");
      qc.invalidateQueries({ queryKey: ["admin", "doctors"] });
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  const items = data?.items ?? [];
  const verified = items.filter((d) => d.slmcVerifiedAt).length;
  const unverified = items.length - verified;
  const specialties = new Set(items.map((d) => d.specialization).filter(Boolean));
  const linked = items.filter((d) => d.hospitalId).length;
  const rated = items.filter((d) => d.rating != null);
  const avgRating = rated.length ? rated.reduce((a, d) => a + (d.rating ?? 0), 0) / rated.length : null;
  const verifiedPct = items.length ? Math.round((verified / items.length) * 100) : 0;

  const filtered = items.filter((d) =>
    slmc === "verified" ? !!d.slmcVerifiedAt : slmc === "unverified" ? !d.slmcVerifiedAt : true,
  );

  const rows: DirectoryRow[] = filtered.map((d) => {
    const busy = verify.isPending && verify.variables?.id === d.doctorId;
    return {
      id: d.doctorId,
      name: d.name,
      onClick: () => setOpenDoctor(d),
      linkLabel: "Documents",
      accent: d.slmcVerifiedAt ? "bg-emerald-500" : "bg-amber-400",
      badges: (
        <>
          {d.slmcVerifiedAt ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-emerald-700">
              <BadgeCheck size={11} />
              SLMC verified
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-amber-700">
              <Clock size={11} />
              Not verified
            </span>
          )}
          {d.status !== "active" ? <Pill tone={statusTone(d.status)}>{humanize(d.status)}</Pill> : null}
        </>
      ),
      meta: [
        { icon: <Stethoscope size={11} />, text: d.specialization || "No specialty" },
        { icon: <Hash size={11} />, text: d.slmcRegistrationNo || "No SLMC no.", mono: true },
        ...(d.email ? [{ icon: <Mail size={11} />, text: d.email, wide: true }] : []),
        ...(d.experience != null ? [{ icon: <Briefcase size={11} />, text: `${d.experience} yrs`, wide: true }] : []),
        ...(d.rating != null ? [{ icon: <Star size={11} />, text: d.rating.toFixed(1), wide: true }] : []),
        ...(d.hospitalId ? [{ icon: <Building2 size={11} />, text: "Hospital linked", wide: true }] : []),
      ],
      searchText: [d.email, d.specialization, d.slmcRegistrationNo].filter(Boolean).join(" "),
      actions: d.slmcVerifiedAt ? (
        <button
          type="button"
          onClick={() => verify.mutate({ id: d.doctorId, action: "revoke-slmc" })}
          disabled={busy}
          className={ROW_BTN_DANGER}
        >
          <ShieldOff size={13} />
          Revoke
        </button>
      ) : (
        <button
          type="button"
          onClick={() => verify.mutate({ id: d.doctorId, action: "verify-slmc" })}
          disabled={busy}
          className={ROW_BTN_APPROVE}
        >
          <ShieldCheck size={13} />
          Verify SLMC
        </button>
      ),
    };
  });

  return (
    <AdminDirectory<Filter>
      hero={
        <DoctorHero
          kickerIcon={<Stethoscope size={13} aria-hidden />}
          kicker="People"
          kickerMeta={`${items.length} registered · ${specialties.size} specialties`}
          title={
            <>
              Doctors &amp;{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                SLMC checks
              </span>
            </>
          }
          description="Review each doctor's Sri Lanka Medical Council registration and supporting documents before they can practise on HealthHub."
          chips={
            <>
              <span className={HERO_CHIP}>
                <BadgeCheck size={12} className="text-emerald-300" aria-hidden />
                {verifiedPct}% verified
              </span>
              {unverified > 0 ? (
                <button
                  type="button"
                  onClick={() => setSlmc("unverified")}
                  className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-400/25"
                >
                  <Clock size={12} aria-hidden />
                  {unverified} awaiting SLMC
                </button>
              ) : null}
            </>
          }
        />
      }
      stats={
        <>
          <StatTile label="All doctors" icon={<Users size={16} />} tone="bg-sky-50 text-sky-600" value={isLoading ? "…" : String(items.length)} sub={`${linked} linked to a hospital`} active={slmc === "all"} onClick={() => setSlmc("all")} />
          <StatTile label="SLMC verified" icon={<BadgeCheck size={16} />} tone="bg-emerald-50 text-emerald-600" value={String(verified)} unit={items.length ? `/ ${items.length}` : undefined} sub="Cleared to practise" progress={items.length ? verifiedPct : null} active={slmc === "verified"} onClick={() => setSlmc("verified")} />
          <StatTile label="Awaiting SLMC" icon={<FileText size={16} />} tone="bg-amber-50 text-amber-600" value={String(unverified)} sub={unverified ? "Documents to review" : "Nothing to review"} pulse={unverified > 0} badge={unverified ? { text: "Action", tone: "bg-amber-50 text-amber-700" } : undefined} active={slmc === "unverified"} onClick={() => setSlmc("unverified")} />
          <StatTile label="Average rating" icon={<Star size={16} />} tone="bg-violet-50 text-violet-600" value={avgRating != null ? avgRating.toFixed(1) : "—"} unit={avgRating != null ? "/ 5" : undefined} sub={`${rated.length} rated doctors`} />
        </>
      }
      title="Doctor directory"
      icon={<Stethoscope size={16} />}
      tone="bg-emerald-50 text-emerald-600"
      rows={rows}
      total={items.length}
      loading={isLoading}
      searchPlaceholder="Search name, email, specialty or SLMC no…"
      segmented={{
        value: slmc,
        onChange: setSlmc,
        options: [
          { value: "all", label: "All", count: items.length },
          { value: "verified", label: "Verified", count: verified },
          { value: "unverified", label: "Not verified", count: unverified },
        ],
      }}
      empty={{ icon: <Stethoscope size={19} />, title: "No doctors match", body: "Doctors appear here once they register and submit their SLMC number." }}
    >
      <Drawer
        open={openDoctor != null}
        onClose={() => setOpenDoctor(null)}
        title={openDoctor?.name ?? ""}
        subtitle={
          openDoctor ? (
            <span>
              {openDoctor.specialization ?? "—"} · SLMC {openDoctor.slmcRegistrationNo ?? "—"}
            </span>
          ) : null
        }
        size="lg"
      >
        {openDoctor ? (
          <div className="flex flex-col gap-5">
            <DoctorSummary
              doctor={items.find((d) => d.doctorId === openDoctor.doctorId) ?? openDoctor}
              busy={verify.isPending && verify.variables?.id === openDoctor.doctorId}
              onVerify={(action) => verify.mutate({ id: openDoctor.doctorId, action })}
            />
            <SlmcDocsPanel doctorId={openDoctor.doctorId} />
          </div>
        ) : null}
      </Drawer>
    </AdminDirectory>
  );
}

function DoctorSummary({
  doctor: d,
  busy,
  onVerify,
}: {
  doctor: Row;
  busy: boolean;
  onVerify: (action: "verify-slmc" | "revoke-slmc") => void;
}) {
  const verified = !!d.slmcVerifiedAt;
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 text-white"
      style={{
        background:
          "radial-gradient(420px 200px at 100% 0%, rgba(14,165,233,0.35), transparent 60%), #07233a",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-emerald-500/30 ring-1 ring-inset ring-white/20">
          <Stethoscope size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{d.name}</p>
          <p className="truncate text-xs text-white/60">
            {[d.specialization, d.email].filter(Boolean).join(" · ") || "No specialty on file"}
          </p>
        </div>
        <span
          className={
            verified
              ? "inline-flex shrink-0 items-center gap-1 rounded-lg border border-emerald-300/30 bg-emerald-400/15 px-2 py-1 text-[11px] font-semibold text-emerald-100"
              : "inline-flex shrink-0 items-center gap-1 rounded-lg border border-amber-300/30 bg-amber-400/15 px-2 py-1 text-[11px] font-semibold text-amber-100"
          }
        >
          {verified ? <BadgeCheck size={12} /> : <Clock size={12} />}
          {verified ? "Verified" : "Pending"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "SLMC no.", value: d.slmcRegistrationNo || "—", mono: true },
          { label: "Experience", value: d.experience != null ? `${d.experience} yrs` : "—" },
          { label: "Rating", value: d.rating != null ? d.rating.toFixed(1) : "—" },
        ].map((x) => (
          <div key={x.label} className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2">
            <p className="text-[10.5px] text-white/50">{x.label}</p>
            <p className={x.mono ? "mt-0.5 truncate font-mono text-[12.5px] font-semibold" : "mt-0.5 truncate text-[13px] font-semibold"}>
              {x.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-[11px] text-white/55">
          {verified ? `Verified ${new Date(d.slmcVerifiedAt!).toLocaleDateString()}` : "Check the certificate below against the SLMC registry."}
        </p>
        {verified ? (
          <button
            type="button"
            onClick={() => onVerify("revoke-slmc")}
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] border border-white/20 bg-white/[0.06] px-3 text-xs font-semibold text-white transition-colors hover:bg-red-500/20 disabled:opacity-50"
          >
            <ShieldOff size={13} />
            Revoke SLMC
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onVerify("verify-slmc")}
            disabled={busy}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-white px-3 text-xs font-semibold text-[#07233a] transition-all hover:-translate-y-px hover:bg-emerald-50 disabled:opacity-50"
          >
            <ShieldCheck size={13} className="text-emerald-600" />
            Verify SLMC
          </button>
        )}
      </div>
    </div>
  );
}
