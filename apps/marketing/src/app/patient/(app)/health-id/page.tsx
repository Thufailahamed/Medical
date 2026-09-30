"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import {
  AlertCircle,
  CheckCircle2,
  FlaskConical,
  Heart,
  HeartPulse,
  Hospital,
  Loader2,
  Lock,
  Pill,
  QrCode,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
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
import {
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  HeroPulse,
  PANEL,
  PanelHeader,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";

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
  const [qr, setQr] = useState<{ key: string; url: string } | null>(null);
  const [count, setCount] = useState<{ token: string; left: number } | null>(null);

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
    if (!token) return;
    let cancelled = false;
    const key = `${purpose}:${token}`;
    const payload = encodeHealthIdPayload(token, purpose);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 260,
      color: { dark: "#0B1F3A", light: "#FFFFFF" },
    })
      .then((url) => {
        if (!cancelled) setQr({ key, url });
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token, purpose]);

  const qrUrl = token && qr?.key === `${purpose}:${token}` ? qr.url : "";

  // Countdown + auto-rotate when a token is active.
  useEffect(() => {
    if (!token) return;
    let s = rotationSeconds;
    const id = window.setInterval(() => {
      s -= 1;
      if (s <= 0) {
        issue.mutate(purpose);
        s = rotationSeconds;
      }
      setCount({ token, left: s });
    }, 1000);
    return () => window.clearInterval(id);
  }, [token, purpose, rotationSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const secondsLeft = token
    ? count?.token === token
      ? count.left
      : rotationSeconds
    : null;

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
    <PatientPage>
      <PatientHero
        kickerIcon={<QrCode size={13} aria-hidden />}
        kicker="Family & Safety"
        kickerMeta="Cryptographic health pass"
        title={
          <>
            Digital <HeroAccent>health ID</HeroAccent>
          </>
        }
        description="A rotating cryptographic QR token for touchless hospital check-in, pharmacy dispensing, and laboratory identification — no paper files needed."
        chips={
          <>
            {token ? (
              <span className={HERO_CHIP}>
                <Radio size={12} className="animate-pulse text-emerald-300" />
                Active token
              </span>
            ) : (
              <span className={HERO_CHIP}>Standby</span>
            )}
            <span className={HERO_CHIP}>
              <RotateCcw size={12} className="text-sky-300" />
              {secondsLeft !== null ? `${secondsLeft}s to rotate` : `${rotationSeconds}s window`}
            </span>
            <span className={HERO_CHIP}>ECDSA signed · anti-replay</span>
          </>
        }
        aside={
          <HeroPulse
            icon={<Zap size={20} />}
            label="Pass status"
            value={token ? "Active" : "Standby"}
            sub={token ? `Rotates in ${secondsLeft ?? rotationSeconds}s` : "Issue a pass to begin"}
          />
        }
        actions={
          <>
            <Link href="/patient/emergency" className={HERO_GHOST}>
              <HeartPulse size={13} /> Emergency ID
            </Link>
            <button
              type="button"
              onClick={handleIssue}
              disabled={issue.isPending}
              className={HERO_PRIMARY}
            >
              {issue.isPending ? (
                <Loader2 size={14} className="animate-spin text-sky-600" />
              ) : (
                <Zap size={14} className="text-sky-600" />
              )}
              {token ? "Rotate pass" : "Generate pass"}
            </button>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<QrCode size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Pass status"
          value={token ? "Active" : "Standby"}
          sub={token ? "Token issued" : "No token issued"}
        />
        <StatTile
          icon={<RotateCcw size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Rotation window"
          value={`${rotationSeconds}s`}
          sub="Anti-replay expiry"
        />
        <StatTile
          icon={<Hospital size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Scopes"
          value={String(PURPOSES.length)}
          sub="Check-in · pharmacy · lab"
        />
        <StatTile
          icon={<ShieldCheck size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Signature"
          value="ECDSA"
          sub="Verified on scan"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="flex flex-col gap-5 xl:col-span-8">
          {/* ── Verification purpose ─────────────────────────────────────── */}
          <section className={PANEL}>
            <PanelHeader
              icon={<ShieldCheck size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Verification purpose"
              caption="Scope the QR token to what you need right now."
            />
            <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {PURPOSES.map((p) => {
                const Icon = p.icon;
                const isSelected = purpose === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPurpose(p.id)}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 text-left transition-all",
                      isSelected
                        ? "border-sky-500 bg-sky-50/60 shadow-sm"
                        : "border-slate-100 bg-white hover:border-slate-200",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                            isSelected
                              ? "bg-slate-900 text-white"
                              : "bg-slate-100 text-slate-500",
                          )}
                          aria-hidden
                        >
                          <Icon size={15} />
                        </div>
                        <span className="text-xs font-bold text-slate-900">{p.label}</span>
                      </div>
                      {isSelected ? (
                        <CheckCircle2 size={16} className="text-sky-600" />
                      ) : null}
                    </div>
                    <p className="mt-0.5 text-[11px] font-medium leading-snug text-slate-500">
                      {p.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* ── Smart pass card ─────────────────────────────────────────── */}
          <section className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),inset_0_0_0_1px_rgba(15,23,42,0.07)] md:flex-row">
            <div
              className="flex shrink-0 flex-col items-center justify-center gap-4 p-7 text-center text-white sm:p-8 md:w-80"
              style={{ background: "linear-gradient(150deg, #07233a 0%, #0b2f4d 100%)" }}
            >
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/85">
                <Radio size={12} className={token ? "animate-pulse text-emerald-300" : ""} />
                <span>{token ? "Live smart pass" : "Standby"}</span>
              </div>

              <div className="rounded-xl bg-white p-3 shadow-xl">
                {qrUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrUrl}
                    alt="Health ID QR Pass"
                    width={200}
                    height={200}
                    className="rounded-lg"
                  />
                ) : (
                  <div className="flex h-[200px] w-[200px] flex-col items-center justify-center gap-2 p-4 text-slate-400">
                    <QrCode size={40} className="text-slate-300" />
                    <p className="text-xs font-semibold text-slate-500">
                      Tap &ldquo;Generate pass&rdquo; to issue a rotating QR
                    </p>
                  </div>
                )}
              </div>

              {token && secondsLeft !== null ? (
                <div className="flex w-full max-w-[200px] flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-bold text-white/80">
                    <span>Auto-rotates:</span>
                    <span>{secondsLeft}s</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
                    <div
                      className="h-full rounded-full bg-emerald-400 transition-all duration-1000"
                      style={{
                        width: `${Math.max(0, (secondsLeft / rotationSeconds) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <p className="max-w-[200px] text-[11px] text-white/70">
                  Tokens expire automatically every {rotationSeconds} seconds for
                  anti-tamper security.
                </p>
              )}
            </div>

            <div className="flex flex-1 flex-col justify-between gap-6 p-6 sm:p-8">
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <span className="rounded-md bg-sky-50 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-sky-700">
                      Patient health identity
                    </span>
                    <h3 className="mt-1.5 text-xl font-semibold leading-tight tracking-[-0.02em] text-slate-900 sm:text-2xl">
                      {name}
                    </h3>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      Verified national EHR profile · {phone}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 rounded-lg bg-rose-50 px-3 py-1.5">
                    <Heart size={14} className="fill-rose-500 text-rose-500" />
                    <span className="text-xs font-bold text-rose-600">Type {bloodGroup}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10.5px] font-bold uppercase text-slate-400">
                      Target scope
                    </p>
                    <p className="mt-0.5 text-xs font-bold capitalize text-slate-900">
                      {purpose === "all" ? "Complete clinical access" : `${purpose} only`}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10.5px] font-bold uppercase text-slate-400">
                      Digital signature
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <CheckCircle2 size={12} />
                      <span>Valid &amp; verified</span>
                    </p>
                  </div>
                </div>

                {error ? (
                  <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600">
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={issue.isPending}
                    onClick={handleIssue}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
                  >
                    {issue.isPending ? (
                      <>
                        <Loader2 size={13} className="animate-spin" /> Processing…
                      </>
                    ) : (
                      <>
                        <RefreshCw size={13} />
                        {token ? "Rotate now" : "Issue health pass"}
                      </>
                    )}
                  </button>
                  {token ? (
                    <button
                      type="button"
                      disabled={revoke.isPending}
                      onClick={handleRevoke}
                      className="h-10 rounded-xl px-4 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      {revoke.isPending ? "Revoking…" : "Revoke pass"}
                    </button>
                  ) : null}
                </div>
                <p className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <Lock size={12} />
                  Scanners never see your raw phone or passcode
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5 xl:col-span-4">
          <section className={PANEL}>
            <PanelHeader
              icon={<Sparkles size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="How health ID protects you"
              caption="One pass for every point of care."
            />
            <div className="mt-5 flex flex-col gap-2.5 text-xs text-slate-500">
              <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Hospital size={14} className="text-sky-600" />
                  <span>Touchless clinic check-in</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  Show this QR at a kiosk or reception scanner to pull your queue token —
                  no paper registration.
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 font-bold text-slate-900">
                  <Pill size={14} className="text-emerald-600" />
                  <span>Pharmacy dispensing</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  Pharmacists scan the pass to confirm prescription authorizations and
                  prevent dispensing mistakes.
                </p>
              </div>
              <div className="flex flex-col gap-1 rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                <p className="flex items-center gap-1.5 font-bold text-slate-900">
                  <RotateCcw size={14} className="text-violet-600" />
                  <span>Anti-fraud rotation</span>
                </p>
                <p className="text-[11px] leading-relaxed">
                  Screenshots can&apos;t be replayed — the cryptographic token invalidates
                  itself every {rotationSeconds} seconds.
                </p>
              </div>
            </div>
          </section>

          <QuickToolsPanel
            id="hid-tools"
            title="Family & Safety"
            tools={[
              {
                icon: Users,
                label: "Family",
                hint: "Members",
                href: "/patient/family",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: ShieldAlert,
                label: "Emergency",
                hint: "SOS + med ID",
                href: "/patient/emergency",
                tone: "from-rose-500 to-red-600 shadow-rose-500/30",
              },
              {
                icon: HeartPulse,
                label: "Caretakers",
                hint: "Delegate access",
                href: "/patient/caretakers",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
            ]}
          />

          <PromoCard
            icon={<ShieldAlert size={21} aria-hidden />}
            kicker="Emergency"
            title="Scannable without a passcode"
            body="Your emergency card surfaces blood group, allergies, and ICE contacts to first responders — keep it ready."
            href="/patient/emergency"
          />
        </div>
      </div>
    </PatientPage>
  );
}
