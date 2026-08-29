"use client";

import { use } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Star,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Stethoscope,
  Clock,
  Building2,
  Award,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { useDoctorDetail } from "@/patient/hooks/doctors";
import { formatDayLabel } from "@/patient/lib/format";

export default function DoctorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useDoctorDetail(id);
  const doctor = data?.doctor;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
        <p className="text-sm text-text-soft">Loading…</p>
      </div>
    );
  }

  if (!doctor) {
    return (
      <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
        <p className="text-sm text-text-soft">Doctor not found.</p>
        <Link
          href="/patient/appointments/book"
          className="text-xs font-semibold text-brand"
        >
          Back to booking
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/appointments/book"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <Card>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div
                className="grid h-20 w-20 shrink-0 place-items-center text-2xl font-bold text-white"
                style={{
                  borderRadius: "var(--radius-pill)",
                  background:
                    "linear-gradient(145deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)",
                }}
                aria-hidden
              >
                {doctor.name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-text">
                    Dr. {doctor.name}
                  </h1>
                  {doctor.available ? (
                    <StatusPill tone="success">Available</StatusPill>
                  ) : null}
                </div>
                <p className="mt-1 text-sm text-text-soft">
                  {doctor.specialization}
                </p>
                {doctor.hospitalName ? (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-text-soft">
                    <Building2 size={13} aria-hidden /> {doctor.hospitalName}
                  </p>
                ) : null}
                {doctor.rating ? (
                  <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                    <Star size={13} aria-hidden /> {doctor.rating.toFixed(1)} rating
                  </p>
                ) : null}
              </div>
              <Link
                href={`/patient/appointments/book?doctorId=${doctor.id}`}
                className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
              >
                <Calendar size={14} aria-hidden /> Book
              </Link>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <h2 className="text-sm font-bold text-text">About</h2>
              <p className="text-sm text-text-soft">
                {doctor.bio ||
                  "Dr. " +
                    doctor.name +
                    " is a dedicated practitioner focused on patient-centered care."}
              </p>
            </div>
          </Card>

          {doctor.consultationFee ? (
            <Card accent="brand">
              <div className="flex items-center justify-between">
                <div>
                  <p className="t-label">Consultation fee</p>
                  <p className="mt-1 text-2xl font-extrabold text-text">
                    LKR {doctor.consultationFee.toLocaleString()}
                  </p>
                  <p className="mt-0.5 text-xs text-text-soft">
                    Pay at visit or via insurance
                  </p>
                </div>
                <Link
                  href={`/patient/appointments/book?doctorId=${doctor.id}`}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white"
                >
                  <Calendar size={14} aria-hidden /> Book now
                </Link>
              </div>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 lg:col-span-4">
          <Card accent="sky">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-text">Quick facts</h3>
              <ul className="flex flex-col gap-2 text-xs text-text-soft">
                <li className="flex items-center gap-2">
                  <Stethoscope size={12} aria-hidden className="text-text-muted" />
                  {doctor.specialization}
                </li>
                {doctor.hospitalName ? (
                  <li className="flex items-center gap-2">
                    <MapPin size={12} aria-hidden className="text-text-muted" />
                    {doctor.hospitalName}
                  </li>
                ) : null}
                {doctor.available ? (
                  <li className="flex items-center gap-2">
                    <Clock size={12} aria-hidden className="text-text-muted" />
                    Accepting new patients
                  </li>
                ) : null}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
