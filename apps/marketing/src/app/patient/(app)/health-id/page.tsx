"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

import { Card } from "@/patient/components/primitives/Card";
import { Pill } from "@/patient/components/primitives/Pill";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  encodeHealthIdPayload,
  useCurrentHealthId,
  useIssueHealthId,
  usePatientProfile,
  useRevokeHealthId,
  type HealthIdPurpose,
} from "@/patient/hooks";

const PURPOSES: HealthIdPurpose[] = ["checkin", "dispense", "id", "all"];

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
      | { patient?: { patients?: { bloodGroup?: string | null }; users?: { name?: string | null } } }
      | undefined
  )?.patient;
  const name = patient?.users?.name ?? "Patient";
  const bloodGroup = patient?.patients?.bloodGroup ?? null;

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
      width: 240,
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

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Identity"
        title="Health ID"
        description="Create a temporary QR identity for check-in and care coordination."
      />

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-soft">
          Purpose
        </p>
        <div className="mb-4 flex flex-wrap gap-2">
          {PURPOSES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPurpose(p)}
              aria-pressed={purpose === p}
              className={[
                "rounded-pill border px-3 py-1.5 text-xs font-semibold capitalize",
                purpose === p
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-border bg-surface-2 text-text-soft",
              ].join(" ")}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="shrink-0 rounded-inner bg-white p-3">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrUrl} alt="Health ID QR code" width={240} height={240} />
            ) : (
              <div className="flex h-[240px] w-[240px] items-center justify-center text-sm text-text-soft">
                {current.isLoading
                  ? "Loading…"
                  : "Issue a Health ID to show a QR"}
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h2 className="text-lg font-bold text-text">{name}</h2>
            {bloodGroup ? (
              <p className="text-sm text-text-soft">
                Blood group:{" "}
                <span className="font-semibold text-text">{bloodGroup}</span>
              </p>
            ) : null}
            <Pill tone={token ? "success" : "neutral"}>
              {token ? `Active · ${purpose}` : "No active token"}
            </Pill>
            {token && secondsLeft !== null ? (
              <p className="text-xs text-text-soft">
                Rotates in {secondsLeft}s
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={issue.isPending}
                onClick={async () => {
                  setError(null);
                  try {
                    await issue.mutateAsync(purpose);
                  } catch (cause) {
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "Could not issue health ID.",
                    );
                  }
                }}
                className="rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {issue.isPending
                  ? "Issuing…"
                  : token
                    ? "Rotate health ID"
                    : "Issue health ID"}
              </button>
              {token ? (
                <button
                  type="button"
                  disabled={revoke.isPending}
                  onClick={async () => {
                    setError(null);
                    try {
                      await revoke.mutateAsync(purpose);
                    } catch (cause) {
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : "Could not revoke health ID.",
                      );
                    }
                  }}
                  className="rounded-pill bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
                >
                  {revoke.isPending ? "Revoking…" : "Revoke"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
