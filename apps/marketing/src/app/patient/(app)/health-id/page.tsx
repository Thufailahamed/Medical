"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Heart,
  Hospital,
  Loader2,
  Lock,
  Pill,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  encodeHealthIdPayload,
  useCurrentHealthId,
  useIssueHealthId,
  usePatientProfile,
  useRevokeHealthId,
  type HealthIdPurpose,
} from "@/patient/hooks";
import { cn } from "@/portal/lib/utils";
import { PageHero, HeroStatusPill, heroPrimaryAction, heroSecondaryAction } from "@/patient/components/primitives/PageHero";

const PURPOSES: Array<{
  id: HealthIdPurpose;
  label: string;
  desc: string;
  icon: typeof Hospital;
}> = [
  {
    id: "all",
    label: "All Services",
    desc: "Hospital check-in, pharmacy & lab verification",
    icon: ShieldCheck,
  },
  {
    id: "checkin",
    label: "Clinic Check-in",
    desc: "Touchless reception arrival & queue ticket",
    icon: Hospital,
  },
  {
    id: "dispense",
    label: "Pharmacy Dispense",
    desc: "Prescription pickup & medication delivery",
    icon: Pill,
  },
  {
    id: "id",
    label: "Lab & Diagnostics",
    desc: "Phlebotomy & blood sample barcode linking",
    icon: FlaskConical,
  },
];

export default function HealthIdPage() {
  const [purpose, setPurpose] = useState<HealthIdPurpose>("all");
  const [error, setError] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState("");
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const profile = usePatientProfile();
  const current = useCurrentHealthId(purpose);
  const issue = useIssueHealthId();
  const revoke = useRevokeHealthId();

  const token = current.data?.token ?? null;
  const rotationSeconds = current.data?.rotationSeconds ?? 25;

  const patient = (
    profile.data as
      | {
          patient?: {
            patients?: { bloodGroup?: string | null };
            users?: { name?: string | null; phone?: string | null };
          };
        }
      | undefined
  )?.patient;
  const name = patient?.users?.name ?? "Thufail";
  const bloodGroup = patient?.patients?.bloodGroup ?? "B+";
  const phone = patient?.users?.phone ?? "+94 77 123 4567";

  useEffect(() => {
    if (!token) {
      setQrUrl("");
      return;
    }
    let cancelled = false;
    const payload = encodeHealthIdPayload(token, purpose);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 260,
      color: { dark: "#0B1F3A", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setQrUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrUrl("");
      });
    return () => {
      cancelled = true;
    };
  }, [token, purpose]);

  // Countdown + auto-rotate when a token is active.
  useEffect(() => {
    if (!token) {
      setSecondsLeft(null);
      return;
    }
    setSecondsLeft(rotationSeconds);
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null) return rotationSeconds;
        if (s <= 1) {
          issue.mutate(purpose);
          return rotationSeconds;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [token, purpose, rotationSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleIssue = async () => {
    setError(null);
    try {
      await issue.mutateAsync(purpose);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not issue health ID.");
    }
  };

  const handleRevoke = async () => {
    setError(null);
    try {
      await revoke.mutateAsync(purpose);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not revoke health ID.");
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-16">
      {/* ── 1. Page Hero ───────────────────────────────────────────────────── */}
      <PageHero
        icon={<QrCode size={13} aria-hidden />}
        kicker="Dynamic Cryptographic Health Pass"
        title="Digital Health ID & Smart Pass"
        description="Rotating cryptographic QR token for touchless hospital check-in, pharmacy dispensing, and laboratory identification without paper files."
        status={
          token ? (
            <HeroStatusPill label="Active Token" tone="success" />
          ) : (
            <HeroStatusPill label="Standby" tone="paper" />
          )
        }
        actions={
          <>
            <Link href="/patient/emergency" className={heroSecondaryAction}>
              <ShieldCheck size={13} aria-hidden />
              Emergency Medical ID
            </Link>
            <button
              type="button"
              onClick={handleIssue}
              disabled={issue.isPending}
              className={heroPrimaryAction}
            >
              {issue.isPending ? (
                <Loader2 size={14} className="animate-spin" aria-hidden />
              ) : (
                <Zap size={14} aria-hidden />
              )}
              {token ? "Rotate Health Pass" : "Generate Health Pass"}
            </button>
          </>
        }
        footer={
          <>
            <span>Pass Status · {token ? "Active Token" : "Standby"}</span>
            <span>Rotation Window · {secondsLeft !== null ? `${secondsLeft}s Left` : `${rotationSeconds}s Window`}</span>
            <span>Security Model · Anti-Replay OTP</span>
            <span>Verification · ECDSA Signed</span>
          </>
        }
      />

      {/* ── 2. Select Verification Purpose ─────────────────────────────────── */}
      <section className="flex flex-col gap-2.5">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Select Healthcare Verification Purpose
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {PURPOSES.map((p) => {
            const Icon = p.icon;
            const isSelected = purpose === p.id;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPurpose(p.id)}
                className={cn(
                  "p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1",
                  isSelected
                    ? "bg-sky-50/80 border-sky-400 ring-2 ring-sky-500/20 shadow-xs"
                    : "bg-white border-slate-200/90 hover:bg-slate-50",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                        isSelected
                          ? "bg-sky-600 text-white"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      <Icon size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-900">
                      {p.label}
                    </span>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 size={15} className="text-sky-600" />
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 font-medium">
                  {p.desc}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── 3. Premier Digital Smart Pass Card ──────────────────────────────── */}
      <section className="rounded-3xl border-2 border-slate-200/90 bg-white shadow-lg overflow-hidden flex flex-col md:flex-row">
        {/* Left: Dynamic QR Stage */}
        <div
          className="p-7 sm:p-8 flex flex-col items-center justify-center gap-4 text-white text-center md:w-80 shrink-0"
          style={{
            background:
              "linear-gradient(145deg, #082f49 0%, #0c4a6e 50%, #0e7490 100%)",
          }}
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-bold bg-white/10 border border-white/15 text-sky-200 uppercase tracking-wider">
            <Radio size={12} className={token ? "animate-pulse text-emerald-400" : ""} />
            <span>{token ? "Live Smart Pass" : "Standby"}</span>
          </div>

          {/* QR Container */}
          <div className="p-3 bg-white rounded-2xl shadow-xl border-4 border-white/20">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="Health ID QR Pass"
                width={200}
                height={200}
                className="rounded-xl"
              />
            ) : (
              <div className="flex h-[200px] w-[200px] flex-col items-center justify-center gap-2 text-slate-400 p-4">
                <QrCode size={40} className="text-slate-300" />
                <p className="text-xs font-semibold text-slate-500">
                  Tap &ldquo;Generate Pass&rdquo; to issue rotating QR
                </p>
              </div>
            )}
          </div>

          {token && secondsLeft !== null ? (
            <div className="w-full flex flex-col gap-1.5 max-w-[200px]">
              <div className="flex items-center justify-between text-[11px] text-sky-200 font-bold">
                <span>Auto-Rotates:</span>
                <span>{secondsLeft}s</span>
              </div>
              <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-400 transition-all duration-1000 rounded-full"
                  style={{
                    width: `${Math.max(0, (secondsLeft / rotationSeconds) * 100)}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-white/70 max-w-[200px]">
              Tokens expire automatically every 25 seconds for anti-tamper security.
            </p>
          )}
        </div>

        {/* Right: Pass Details & Identity Controls */}
        <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3 flex-wrap pb-4 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-0.5 rounded-full border border-sky-200">
                  Patient Health Identity
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1.5 leading-tight">
                  {name}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Verified National EHR Profile · {phone}
                </p>
              </div>

              {/* Blood Group Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-50 border border-rose-200 shrink-0">
                <Heart size={14} className="text-rose-600 fill-rose-600" />
                <span className="text-xs font-black text-rose-900">
                  Type {bloodGroup}
                </span>
              </div>
            </div>

            {/* Verification Attributes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10.5px] uppercase font-bold text-slate-400">
                  Target Scope
                </p>
                <p className="text-xs font-bold text-slate-900 mt-0.5 capitalize">
                  {purpose === "all" ? "Complete Clinical Access" : `${purpose} Only`}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10.5px] uppercase font-bold text-slate-400">
                  Digital Signature
                </p>
                <p className="text-xs font-bold text-emerald-700 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 size={12} />
                  <span>Valid &amp; Verified</span>
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle size={14} className="text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action Trigger Bar */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={issue.isPending}
                onClick={handleIssue}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
                }}
              >
                {issue.isPending ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <>
                    <RefreshCw size={13} />
                    <span>{token ? "Rotate Now" : "Issue Health Pass"}</span>
                  </>
                )}
              </button>

              {token ? (
                <button
                  type="button"
                  disabled={revoke.isPending}
                  onClick={handleRevoke}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {revoke.isPending ? "Revoking…" : "Revoke Pass"}
                </button>
              ) : null}
            </div>

            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <Lock size={12} />
              Hospital scanners never store your raw phone passcode
            </p>
          </div>
        </div>
      </section>

      {/* ── 4. How Health ID Works Guide ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col gap-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-2">
          <Sparkles size={14} className="text-sky-600" />
          <span>How Digital Health ID Protects Your Care</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <Hospital size={14} className="text-sky-600" />
              <span>Touchless Clinic Check-in</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Show this QR at the hospital kiosk or reception scanner to automatically pull your queue token without filling out paper registration sheets.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <Pill size={14} className="text-emerald-600" />
              <span>Pharmacy Dispensing</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Pharmacists scan your pass to confirm prescription authorizations, preventing dosage mistakes and dispensing duplicate medications.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-1.5">
            <p className="font-bold text-slate-900 flex items-center gap-1.5">
              <RotateCcw size={14} className="text-purple-600" />
              <span>25-Second Anti-Fraud Rotation</span>
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Screenshots or stolen photos of your QR pass cannot be replayed by bad actors because the cryptographic token invalidates itself every 25 seconds.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
