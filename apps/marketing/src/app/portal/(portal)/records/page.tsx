"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Search,
  FileText,
  Calendar,
  ChevronRight,
  Tag,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { PageHeader, SectionHeader } from "@/portal/components/ui/PageHeader";
import { useT } from "@/portal/i18n";
import { formatDate } from "@/portal/lib/format";
import { cn } from "@/portal/lib/utils";

interface MedicalRecord {
  id: string;
  patientId: string;
  title: string;
  /** Canonical record-type field (v3). Falls back to `recordType` for older rows. */
  kind: string;
  /** Legacy record-type enum (v1/v2). Used when `kind` is absent. */
  recordType?: string | null;
  date: string | null;
  tags: string[] | null;
  createdAt: string;
  patient: { id: string; name: string } | null;
}

export default function RecordsPage() {
  const t = useT();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "records"],
    queryFn: () =>
      api<{ records: MedicalRecord[]; total: number }>(
        "/doctor-portal/records?limit=200"
      ),
  });

  const allRecords = data?.records ?? [];

  // Normalize to the canonical kind for filter + display.
  const typeOf = (r: MedicalRecord) => r.kind || r.recordType || "other";
  const types = ["all", ...new Set(allRecords.map(typeOf))];

  const filtered = allRecords.filter((record) => {
    const matchesSearch =
      !search.trim() ||
      [
        record.title,
        typeOf(record),
        record.patient?.name,
        ...(record.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesType = typeFilter === "all" || typeOf(record) === typeFilter;

    return matchesSearch && matchesType;
  });

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t("records.title")}
        subtitle={t("records.subtitle", { count: allRecords.length })}
        icon={<FileText size={18} className="text-sky-600" />}
      />

      {/* Search & Filters */}
      <Card padding={false} className="rounded-2xl border-border/50">
        <div className="px-3 py-2 flex items-center gap-2 border-b border-border/50">
          <Search size={16} className="text-text-muted shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("records.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-xs text-text-muted hover:text-text transition-colors"
            >
              {t("common.clear")}
            </button>
          )}
        </div>
        <div className="px-3 py-2 flex flex-wrap gap-1.5">
          {types.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setTypeFilter(type)}
              className={cn(
                "px-2.5 h-7 rounded-xl text-xs border transition-colors",
                typeFilter === type
                  ? "bg-sky-50 text-sky-700 border-sky-200/60"
                  : "bg-surface text-text-soft border-border/60 hover:bg-surface-2/40"
              )}
            >
              {type === "all" ? t("common.all") : type}
            </button>
          ))}
        </div>
      </Card>

      {/* Records List */}
      <Card padding={false} className="rounded-2xl border-border/50">
        {isLoading ? (
          <div className="p-4 flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Empty
            title={search || typeFilter !== "all" ? t("records.emptySearch") : t("records.empty")}
            className="py-12"
          />
        ) : (
          <ul className="flex flex-col">
            {filtered.map((record) => (
              <li
                key={record.id}
                className="group flex items-center gap-3 p-4 border-b border-border/50 last:border-0 hover:bg-surface-2/40 transition-colors"
              >
                <div className="h-10 w-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                  <FileText size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-text truncate">
                    {record.title}
                  </div>
                  <div className="text-xs text-text-soft truncate">
                    {record.patient?.name || t("records.unknownPatient")} · {typeOf(record)}
                  </div>
                  {record.tags && record.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {record.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] bg-surface-2 text-text-muted"
                        >
                          <Tag size={8} />
                          {tag}
                        </span>
                      ))}
                      {record.tags.length > 3 && (
                        <span className="text-[10px] text-text-muted">
                          +{record.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {record.date && (
                    <div className="flex items-center gap-1">
                      <Calendar size={11} className="text-text-muted" />
                      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
                        {formatDate(record.date)}
                      </span>
                    </div>
                  )}
                  <ChevronRight size={16} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
