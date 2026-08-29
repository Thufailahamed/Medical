"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { ShieldCheck, ArrowLeft, Share2, Copy, Phone } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { formatDate, formatLkr } from "@/portal/lib/format";

interface EcardResponse {
  ecard: {
    id: string;
    cardNumber: string;
    qrToken: string;
    issuedAt: string;
    validUntil: string;
    holderName: string | null;
    providerName: string | null;
    planName: string | null;
    policyNumber: string | null;
    coverageAmountLkr: number | null;
  };
  policyNumber: string | null;
  providerName: string | null;
  holderName: string | null;
}

export default function EcardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [qrUrl, setQrUrl] = useState<string>("");

  const q = useQuery({
    queryKey: ["insurance", "ecard", id],
    queryFn: () =>
      api<EcardResponse>(`/insurance-marketplace/enrollments/${id}/ecard`),
  });

  const card = q.data?.ecard;
  const valid = card
    ? new Date(card.validUntil).getTime() > Date.now()
    : false;

  // Generate a data-URL QR client-side so we never depend on a third party.
  useEffect(() => {
    if (!card?.qrToken) {
      setQrUrl("");
      return;
    }
    const payload = JSON.stringify({
      t: card.qrToken,
      p: card.policyNumber,
      c: card.cardNumber,
    });
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#0B1F3A", light: "#FFFFFF" },
    })
      .then(setQrUrl)
      .catch(() => setQrUrl(""));
  }, [card?.qrToken, card?.policyNumber, card?.cardNumber]);

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  if (!card) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-soft">E-card unavailable.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5 max-w-xl">
      <Link
        href={`/portal/me/insurance/policy/${id}`}
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to policy
      </Link>

      {!valid ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <p className="text-sm text-amber-800">
            E-card is only available when your policy is active.
          </p>
        </Card>
      ) : null}

      <Card className="bg-gradient-to-br from-brand to-brand-strong text-white border-0 overflow-hidden relative">
        <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-16 -left-12 h-48 w-48 rounded-full bg-white/5" />
        <div className="relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
                Digital E-Card
              </div>
              <div className="text-lg font-bold mt-1">
                {card.providerName ?? "Insurer"}
              </div>
              <div className="text-xs text-white/80">{card.planName}</div>
            </div>
            <ShieldCheck size={28} className="text-white/80" />
          </div>

          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
              Policy number
            </div>
            <div className="text-2xl font-bold tracking-wider font-mono mt-1">
              {card.policyNumber ?? card.id.slice(0, 12).toUpperCase()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
                Coverage
              </div>
              <div className="text-lg font-bold">
                {formatLkr(card.coverageAmountLkr ?? 0)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
                Valid until
              </div>
              <div className="text-lg font-bold">
                {formatDate(card.validUntil)}
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white rounded-2xl p-4 flex flex-col items-center">
            {qrUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qrUrl}
                alt="E-card QR"
                width={220}
                height={220}
                className="rounded-lg"
              />
            ) : (
              <div className="h-[220px] w-[220px] rounded-lg bg-surface-2" />
            )}
            <div className="mt-3 text-text font-mono font-bold tracking-widest text-lg">
              {card.cardNumber}
            </div>
            <div className="text-[11px] text-text-soft mt-1">
              Scan at network hospitals
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
                Holder
              </div>
              <div className="text-sm font-bold">
                {card.holderName ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
                Issued
              </div>
              <div className="text-sm font-bold">
                {formatDate(card.issuedAt)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="font-bold text-text">Show at network hospitals</h2>
        <p className="text-sm text-text-soft mt-1">
          This card unlocks cashless treatment at any hospital in your
          insurer&apos;s network. Front-desk staff will scan or look up your
          policy number.
        </p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => {
              if (typeof navigator !== "undefined" && "share" in navigator) {
                (navigator as any).share({
                  title: "Insurance E-card",
                  text: `${card.providerName ?? "Insurer"} · ${card.policyNumber ?? card.id} · ${card.cardNumber}`,
                });
              }
            }}
            className="portal-btn portal-btn-secondary portal-btn-sm"
          >
            <Share2 size={12} />
            Share
          </button>
          <button
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.clipboard) {
                navigator.clipboard.writeText(card.cardNumber).catch(() => {});
              }
            }}
            className="portal-btn portal-btn-ghost portal-btn-sm"
          >
            <Copy size={12} />
            Copy number
          </button>
        </div>
      </Card>
    </div>
  );
}