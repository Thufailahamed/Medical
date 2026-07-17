"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ArrowLeft, Share2 } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { formatDate, formatLkr } from "@/portal/lib/format";

interface EcardResponse {
  enrollment: {
    id: string;
    policyNumber: string | null;
    status: string;
    coverageAmountLkr: number;
    endDate: string | null;
    providerName: string;
    planName: string;
  };
}

export default function EcardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const q = useQuery({
    queryKey: ["insurance", "ecard", id],
    queryFn: () =>
      api<EcardResponse>(`/insurance-marketplace/enrollments/${id}/ecard`),
  });

  if (q.isLoading) return <Skeleton className="h-64 w-full" />;
  const e = q.data?.enrollment;
  if (!e) {
    return (
      <Card className="text-center py-12">
        <p className="text-sm text-text-soft">E-card unavailable.</p>
      </Card>
    );
  }

  const isActive = e.status === "active";

  return (
    <div className="space-y-5 max-w-xl">
      <Link
        href={`/portal/me/insurance/policy/${id}`}
        className="text-xs text-brand hover:text-brand-strong font-semibold inline-flex items-center gap-1"
      >
        <ArrowLeft size={12} />
        Back to policy
      </Link>

      {!isActive ? (
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
              <div className="text-lg font-bold mt-1">{e.providerName}</div>
              <div className="text-xs text-white/80">{e.planName}</div>
            </div>
            <ShieldCheck size={28} className="text-white/80" />
          </div>

          <div className="mt-8">
            <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
              Policy number
            </div>
            <div className="text-2xl font-bold tracking-wider font-mono mt-1">
              {e.policyNumber ?? e.id.slice(0, 12).toUpperCase()}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
                Coverage
              </div>
              <div className="text-lg font-bold">
                {formatLkr(e.coverageAmountLkr)}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold">
                Valid until
              </div>
              <div className="text-lg font-bold">
                {e.endDate ? formatDate(e.endDate) : "—"}
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
                  text: `${e.providerName} · ${e.policyNumber ?? e.id}`,
                });
              }
            }}
            className="portal-btn portal-btn-secondary portal-btn-sm"
          >
            <Share2 size={12} />
            Share
          </button>
        </div>
      </Card>
    </div>
  );
}