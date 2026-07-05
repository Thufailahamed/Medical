"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, MapPin, Phone, Users } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Skeleton, Empty } from "@/portal/components/ui/Empty";
import { Avatar } from "@/portal/components/ui/Avatar";

interface ClinicDetail {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  doctors?: Array<{
    doctorId: string;
    doctorName: string;
    role?: string;
    specialization?: string;
  }>;
}

export default function ClinicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: ["clinics", id],
    queryFn: () => api<ClinicDetail>(`/clinics/${id}`),
    enabled: !!id,
  });

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/portal/clinics"
        className="inline-flex items-center gap-1 text-xs text-text-soft hover:text-text"
      >
        <ArrowLeft size={12} /> Back to clinics
      </Link>

      {isLoading ? (
        <Card>
          <Skeleton className="h-12 w-full" />
        </Card>
      ) : !data ? (
        <Card>
          <Empty title="Clinic not found" />
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-lg bg-brand-soft text-brand flex items-center justify-center">
                <Building2 size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-semibold text-text">{data.name}</h1>
                <div className="flex flex-col gap-1 mt-1 text-xs text-text-soft">
                  {data.address ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} /> {data.address}
                    </span>
                  ) : null}
                  {data.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone size={11} /> {data.phone}
                    </span>
                  ) : null}
                  {data.email ? (
                    <span className="inline-flex items-center gap-1">✉ {data.email}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Card padding={false}>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-1.5">
                  <Users size={14} /> Doctors
                </span>
              }
            />
            {(data.doctors ?? []).length === 0 ? (
              <Empty title="No doctors linked" className="m-4" />
            ) : (
              <ul className="divide-y divide-border">
                {(data.doctors ?? []).map((d) => (
                  <li key={d.doctorId} className="flex items-center gap-3 px-4 py-2.5">
                    <Avatar name={d.doctorName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text truncate">
                        {d.doctorName}
                      </div>
                      {d.specialization ? (
                        <div className="text-xs text-text-soft truncate">
                          {d.specialization}
                        </div>
                      ) : null}
                    </div>
                    {d.role ? <Pill tone="brand">{d.role}</Pill> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  );
}