"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Plus,
  ChevronRight,
  Inbox,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { formatDate, formatLkr } from "@/portal/lib/format";

interface Claim {
  id: string;
  claimNumber: string | null;
  status: string;
  treatmentType: string;
  claimedAmountLkr: number;
  approvedAmountLkr?: number | null;
  submittedAt: string | null;
}

const STATUS_TONE: Record<string, "success" | "warn" | "danger" | "info" | "neutral"> = {
  submitted: "info",
  under_review: "warn",
  more_info_needed: "warn",
  approved: "success",
  rejected: "danger",
  paid: "success",
};

export default function ClaimsListPage() {
  const q = useQuery({
    queryKey: ["insurance", "claims", "me"],
    queryFn: () =>
      api<{ claims: Claim[] }>("/insurance-marketplace/claims/me"),
  });

  const claims = q.data?.claims ?? [];

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">My claims</h1>
          <p className="text-sm text-text-soft mt-0.5">
            Reimbursement claims you&apos;ve submitted.
          </p>
        </div>
        <Link href="/portal/me/insurance/claims/new">
          <Button>
            <Plus size={14} />
            New claim
          </Button>
        </Link>
      </header>

      {q.isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : claims.length === 0 ? (
        <Card className="text-center py-12">
          <Inbox size={28} className="mx-auto text-text-muted" />
          <p className="text-sm text-text-soft mt-2">No claims submitted yet.</p>
          <div className="mt-4">
            <Link href="/portal/me/insurance/claims/new">
              <Button size="sm">
                <Plus size={14} />
                Submit your first claim
              </Button>
            </Link>
          </div>
        </Card>
      ) : (
        <div className="space-y-2">
          {claims.map((c) => (
            <Link
              key={c.id}
              href={`/portal/me/insurance/claims/${c.id}`}
              className="block"
            >
              <Card className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-soft text-brand-strong flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-text text-sm truncate">
                      {c.claimNumber ?? `Claim ${c.id.slice(0, 8)}`}
                    </div>
                    <Pill tone={STATUS_TONE[c.status] ?? "neutral"}>
                      {c.status.replace(/_/g, " ")}
                    </Pill>
                  </div>
                  <div className="text-xs text-text-soft mt-0.5">
                    {c.treatmentType.replace(/_/g, " ")} ·{" "}
                    {formatLkr(c.claimedAmountLkr)} claimed
                    {c.submittedAt ? ` · ${formatDate(c.submittedAt)}` : ""}
                  </div>
                </div>
                <ChevronRight size={16} className="text-text-muted shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}