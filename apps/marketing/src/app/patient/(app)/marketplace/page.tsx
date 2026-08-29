"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Star, MapPin, Shield, ChevronRight, BadgeCheck } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { useMarketplace } from "@/patient/hooks/marketplace";

export default function MarketplacePage() {
  const [search, setSearch] = useState("");
  const [service, setService] = useState<string>("");
  const query = useMarketplace({ search, service });

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader
        label="Care at home"
        title="Caretaker marketplace"
        description="Find verified caretakers, nurses, and physiotherapists for home visits across Sri Lanka."
        action={
          <Link
            href="/patient/marketplace/inquiries"
            className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft hover:text-brand"
          >
            My inquiries <ChevronRight size={12} aria-hidden />
          </Link>
        }
      />

      <Card>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={14}
                aria-hidden
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, city, or service…"
                className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="h-11 rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
            >
              <option value="">All services</option>
              <option value="elder_care">Elder care</option>
              <option value="post_surgery">Post-surgery</option>
              <option value="physio">Physiotherapy</option>
              <option value="child_care">Child care</option>
              <option value="palliative">Palliative</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {query.data?.caretakers.map((c) => (
          <Link
            key={c.id}
            href={`/patient/marketplace/${c.id}`}
            className="group flex flex-col gap-3 rounded-inner border border-[color:var(--color-border)] bg-surface-1 p-4 transition-all hover:border-brand hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              {c.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.photoUrl}
                  alt=""
                  className="h-14 w-14 rounded-pill object-cover"
                />
              ) : (
                <div
                  className="grid h-14 w-14 place-items-center text-base font-bold text-white"
                  style={{
                    borderRadius: "var(--radius-pill)",
                    background:
                      "linear-gradient(145deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)",
                  }}
                  aria-hidden
                >
                  {c.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="truncate text-sm font-semibold text-text">
                    {c.name}
                  </h3>
                  {c.verified ? (
                    <BadgeCheck size={14} aria-hidden className="text-success" />
                  ) : null}
                </div>
                {c.city ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-text-soft">
                    <MapPin size={11} aria-hidden /> {c.city}
                  </p>
                ) : null}
                {c.rating ? (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-amber-600">
                    <Star size={11} aria-hidden /> {c.rating.toFixed(1)} · {c.reviewCount} reviews
                  </p>
                ) : null}
              </div>
              {c.hourlyRate ? (
                <div className="text-right">
                  <p className="text-base font-extrabold text-text">
                    LKR {c.hourlyRate.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-text-muted">per hour</p>
                </div>
              ) : null}
            </div>
            {c.services.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {c.services.slice(0, 3).map((s) => (
                  <StatusPill key={s} tone="info">
                    {s.replace(/_/g, " ")}
                  </StatusPill>
                ))}
              </div>
            ) : null}
            {c.bio ? (
              <p className="line-clamp-2 text-xs text-text-soft">{c.bio}</p>
            ) : null}
          </Link>
        ))}
      </div>

      {query.data?.caretakers.length === 0 ? (
        <Card>
          <p className="text-sm text-text-soft">No caretakers match your filters.</p>
        </Card>
      ) : null}
    </div>
  );
}
