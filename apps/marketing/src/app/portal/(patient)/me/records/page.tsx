"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton } from "@/portal/components/ui/Empty";
import { Input } from "@/portal/components/ui/Form";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";

interface MedicalRecord {
  id: string;
  title: string;
  /** Canonical (v3) record-type field. */
  kind?: string | null;
  /** Legacy record-type enum. */
  recordType: string;
  date: string | null;
  diagnosis: string | null;
  summary: string | null;
  createdAt: string;
}

const TYPE_TONE: Record<string, "info" | "success" | "warn" | "violet" | "neutral"> = {
  lab_report: "info",
  imaging: "warn",
  prescription: "success",
  discharge_summary: "violet",
  other: "neutral",
};

export default function PatientRecordsPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["patient", "me", "records", { q: search, kind }],
    queryFn: () => {
      const p = new URLSearchParams();
      if (search.trim()) p.set("q", search.trim());
      if (kind !== "all") p.set("kind", kind);
      p.set("limit", "100");
      return api<{ records: MedicalRecord[]; total: number }>(
        `/medical-records/me?${p.toString()}`
      );
    },
  });

  const records = data?.records ?? [];
  const kinds = ["all", ...new Set(records.map((r) => r.kind || r.recordType))];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-xl font-bold text-text">My records</h1>
        <p className="text-sm text-text-soft mt-0.5">
          {data?.total ?? records.length} record
          {(data?.total ?? records.length) === 1 ? "" : "s"}
        </p>
      </header>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search records…"
            className="pl-9"
          />
        </div>
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="rounded-md border border-border bg-surface-1 px-3 py-2 text-sm"
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k === "all" ? "All types" : k.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : records.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <FileText size={28} className="mx-auto text-text-muted" />
            <p className="text-sm text-text-soft mt-2">
              No records yet. Use the mobile app to add your first record.
            </p>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {records.map((r) => {
            const rKind = r.kind || r.recordType;
            return (
              <Card key={r.id} className="p-3">
                <div className="flex items-start gap-3">
                  <div className="h-9 w-9 rounded-lg bg-surface-2 text-text-soft flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-text truncate">
                        {r.title}
                      </span>
                      <Pill tone={TYPE_TONE[rKind] ?? "neutral"}>{rKind}</Pill>
                    </div>
                    {r.diagnosis ? (
                      <p className="text-xs text-text-soft mt-0.5">
                        {r.diagnosis}
                      </p>
                    ) : null}
                    <p className="text-[11px] text-text-muted mt-1">
                      {r.date ? formatDate(r.date) : formatDate(r.createdAt)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
