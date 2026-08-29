"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Card } from "@/patient/components/primitives/Card";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api } from "@/portal/lib/api";

export default function DiagnosticTestDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const query = useQuery({
    queryKey: ["patient", "diagnostic-tests", "detail", slug],
    queryFn: () => api<{ test: { id: string; name: string; description: string | null; price: number; discountPrice: number | null; sampleType: string | null; fastingRequired: boolean }; packages: unknown[] }>(`/diagnostic-tests/catalog/${encodeURIComponent(slug)}`),
  });
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function book() {
    if (!query.data?.test || !date || !time || !addressLine1 || !city || !district || !contactPhone) return;
    setError(null);
    setStatus(null);
    try {
      await api("/diagnostic-tests/book", { method: "POST", json: { bookingType: "single_test", testId: query.data.test.id, scheduledDate: date, scheduledTimeSlot: time, collectionAddress: { line1: addressLine1, city, district, contactPhone }, paymentMethod: "cash" } });
      setStatus("Test booking requested.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not book this test.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <SectionHeader label="Diagnostics" title="Test details" description="Review preparation requirements and request home collection." />
      <Card>
        <QueryBoundary query={query} loadingCount={3} emptyTitle="Test not found" emptyDescription="This diagnostic test is no longer available.">
          {({ test }) => (
            <div className="flex flex-col gap-4">
              <div><h1 className="text-xl font-bold text-text">{test.name}</h1><p className="mt-2 text-sm text-text-soft">{test.description ?? "No additional description provided."}</p></div>
              <p className="text-sm font-semibold text-text">LKR {test.discountPrice ?? test.price} · {test.sampleType ?? "Sample collection"}{test.fastingRequired ? " · Fasting required" : ""}</p>
              <div className="grid gap-3 sm:grid-cols-2"><label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">Time slot<input type="text" value={time} onChange={(event) => setTime(event.target.value)} placeholder="e.g. morning" className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">Address line 1<input value={addressLine1} onChange={(event) => setAddressLine1(event.target.value)} className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">City<input value={city} onChange={(event) => setCity(event.target.value)} className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">District<input value={district} onChange={(event) => setDistrict(event.target.value)} className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /></label><label className="flex flex-col gap-1 text-xs font-semibold text-text-soft">Contact phone<input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="h-10 rounded-inner border border-border bg-surface-2 px-3 text-sm text-text" /></label></div>
              {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}{status ? <p role="status" className="text-sm font-semibold text-success">{status}</p> : null}
              <button type="button" onClick={book} disabled={!date || !time || !addressLine1 || !city || !district || !contactPhone} className="self-start rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Book home collection</button>
            </div>
          )}
        </QueryBoundary>
      </Card>
    </div>
  );
}
