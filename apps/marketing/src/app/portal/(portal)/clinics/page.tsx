"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Phone } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { useT } from "@/portal/i18n";

interface Clinic {
  id: string;
  name: string;
  address?: string | null;
  phone?: string | null;
  role?: string;
  ownershipPct?: number;
  joinedAt?: string;
}

export default function ClinicsPage() {
  const t = useT();
  const { data, isLoading } = useQuery({
    queryKey: ["clinics", "mine"],
    queryFn: () => api<Clinic[]>(`/clinics`),
  });

  const list = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-text">{t("clinics.title")}</h1>
        <p className="text-sm text-text-soft mt-1">{t("clinics.subtitle")}</p>
      </div>

      {isLoading ? (
        <Card>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full mt-2" />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <Empty title={t("clinics.empty")} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((c) => (
            <Card key={c.id}>
              <Link href={`/clinics/${c.id}`} className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-brand-soft text-brand flex items-center justify-center shrink-0">
                  <Building2 size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text truncate">
                      {c.name}
                    </h3>
                    {c.role ? <Pill tone="brand">{c.role}</Pill> : null}
                    {c.ownershipPct ? (
                      <Pill tone="violet">{c.ownershipPct}% owner</Pill>
                    ) : null}
                  </div>
                  {c.address ? (
                    <div className="text-xs text-text-soft mt-1 flex items-center gap-1">
                      <MapPin size={11} /> {c.address}
                    </div>
                  ) : null}
                  {c.phone ? (
                    <div className="text-xs text-text-soft mt-0.5 flex items-center gap-1">
                      <Phone size={11} /> {c.phone}
                    </div>
                  ) : null}
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}