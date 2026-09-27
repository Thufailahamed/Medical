"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Star, MapPin, ChevronRight } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { PhotoCard } from "@/patient/components/primitives/PhotoCard";
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
          <PhotoCard
            key={c.id}
            href={`/patient/marketplace/${c.id}`}
            imageSrc={c.photoUrl}
            fallbackInitials={c.name?.[0]?.toUpperCase() ?? "?"}
            alt={`${c.name} portrait`}
            badge={
              c.verified ? (
                <StatusPill tone="success">Verified</StatusPill>
              ) : undefined
            }
            title={c.name}
            meta={
              <>
                {c.city ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={11} aria-hidden /> {c.city}
                  </span>
                ) : null}{" "}
                {c.rating ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                    <Star size={11} aria-hidden /> {c.rating.toFixed(1)} · {c.reviewCount} reviews
                  </span>
                ) : null}
                {c.services.length > 0 ? (
                  <span className="mt-1.5 flex flex-wrap gap-1.5">
                    {c.services.slice(0, 3).map((s) => (
                      <StatusPill key={s} tone="info">
                        {s.replace(/_/g, " ")}
                      </StatusPill>
                    ))}
                  </span>
                ) : null}
              </>
            }
            footer={
              <>
                {c.hourlyRate ? (
                  <p className="flex items-baseline justify-between">
                    <span className="pt-metric text-xl text-text">
                      LKR {c.hourlyRate.toLocaleString()}
                    </span>
                    <span className="t-micro">per hour</span>
                  </p>
                ) : null}
                {c.bio ? (
                  <p className="mt-1 line-clamp-2 text-xs text-text-soft">{c.bio}</p>
                ) : null}
              </>
            }
          />
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
