"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Hospital, Plus } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { Empty } from "@/portal/components/ui/Empty";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import Link from "next/link";

export default function WardsPage() {
  const t = useT();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", type: "general", capacity: "" });

  const list = useQuery({
    queryKey: ["wards"],
    queryFn: () => api<{ wards: any[] }>("/hospital-portal/wards"),
  });

  const create = useMutation({
    mutationFn: (body: any) =>
      api("/hospital-portal/wards", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wards"] });
      setOpen(false);
      setForm({ name: "", type: "general", capacity: "" });
      toast.success("Ward created");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.wards")}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus size={14} className="mr-1.5" />
            {t("wards.newWard")}
          </Button>
        }
      />

      {list.isLoading ? (
        <Card>{t("common.loading")}</Card>
      ) : !list.data?.wards?.length ? (
        <Empty
          title={t("wards.noWards")}
          icon={<Hospital size={28} className="text-text-muted opacity-40" />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.data.wards.map((w: any) => (
            <Card key={w.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/hospital/wards/${w.id}`}
                    className="text-base font-bold text-text hover:text-brand transition-colors inline-flex items-center gap-1"
                  >
                    {w.name}
                    <ArrowRight size={12} />
                  </Link>
                  <p className="mt-0.5 text-xs capitalize text-text-muted">{w.type}</p>
                </div>
                <Pill tone="info">{w.capacity} {t("wards.beds")}</Pill>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={t("wards.newWard")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              capacity: parseInt(form.capacity || "0", 10),
            });
          }}
        >
          <FormField label={t("common.name")} required>
            <input
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label="Type">
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              <option value="general">General</option>
              <option value="icu">ICU</option>
              <option value="pediatric">Pediatric</option>
              <option value="maternity">Maternity</option>
              <option value="surgical">Surgical</option>
            </select>
          </FormField>
          <FormField label={t("wards.capacity")} required>
            <input
              required
              type="number"
              min={1}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {t("common.save")}
            </Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}