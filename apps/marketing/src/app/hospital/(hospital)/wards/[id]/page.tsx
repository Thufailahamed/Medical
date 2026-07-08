"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/portal/components/ui/Form";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";

const BED_STATUS_TONES: Record<string, any> = {
  available: "success",
  occupied: "warning",
  cleaning: "info",
  maintenance: "muted",
};

export default function WardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ bedNumber: "" });

  const beds = useQuery({
    queryKey: ["beds", id],
    queryFn: () => api<{ beds: any[] }>(`/hospital-portal/beds?wardId=${id}`),
    refetchInterval: 30_000,
  });

  const createBed = useMutation({
    mutationFn: (body: any) =>
      api("/hospital-portal/beds", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["beds", id] });
      setOpen(false);
      setForm({ bedNumber: "" });
      toast.success("Bed added");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const setStatus = useMutation({
    mutationFn: ({ bedId, status }: { bedId: string; status: string }) =>
      api(`/hospital-portal/beds/${bedId}/status`, {
        method: "PUT",
        json: { status },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["beds", id] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={tr(locale, "wards.wardDetail")} />

      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}>+ {tr(locale, "wards.addBed")}</Button>
      </div>

      {beds.isLoading ? (
        <Card>{tr(locale, "common.loading")}</Card>
      ) : !beds.data?.beds?.length ? (
        <Card>
          <p className="text-sm text-[var(--text-muted)]">{tr(locale, "wards.noBeds")}</p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {beds.data.beds.map((b: any) => (
            <Card key={b.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{b.bedNumber}</span>
                <Pill tone={BED_STATUS_TONES[b.status] ?? "muted"}>{b.status}</Pill>
              </div>
              <select
                value={b.status}
                onChange={(e) =>
                  setStatus.mutate({ bedId: b.id, status: e.target.value })
                }
                className="rounded border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-1 text-xs"
              >
                <option value="available">available</option>
                <option value="occupied">occupied</option>
                <option value="cleaning">cleaning</option>
                <option value="maintenance">maintenance</option>
              </select>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={tr(locale, "wards.addBed")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            createBed.mutate({ wardId: id, ...form });
          }}
        >
          <FormField label={tr(locale, "wards.bedNumber")} required>
            <input
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.bedNumber}
              onChange={(e) => setForm({ bedNumber: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tr(locale, "common.cancel")}
            </Button>
            <Button type="submit">{tr(locale, "common.save")}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}