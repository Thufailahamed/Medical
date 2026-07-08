"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatLkr } from "@/hospital/lib/format";

type LineItem = {
  description: string;
  quantity: number;
  unitPriceLkr: number;
  kind: string;
};

export default function NewInvoicePage() {
  const t = useT();
  const router = useRouter();
  const locale = useAuthStore((s) => s.locale);
  const [form, setForm] = useState({
    patientId: "",
    visitType: "opd",
    notes: "",
  });
  const [items, setItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPriceLkr: 0, kind: "consultation" },
  ]);

  const subtotal = items.reduce(
    (acc, li) => acc + (li.quantity || 0) * (li.unitPriceLkr || 0),
    0
  );

  const create = useMutation({
    mutationFn: (body: any) =>
      api("/hospital-portal/billing/invoices", { method: "POST", json: body }),
    onSuccess: (data: any) => {
      toast.success("Invoice created");
      router.push(`/hospital/billing/${data.invoice.id}`);
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("billing.newInvoice")} />

      <Card>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({ ...form, lineItems: items });
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t("billing.patientId")} required>
              <input
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                value={form.patientId}
                onChange={(e) => setForm({ ...form, patientId: e.target.value })}
              />
            </FormField>
            <FormField label={t("billing.visitType")}>
              <select
                className="w-full rounded-lg border border-border bg-surface px-3 py-2"
                value={form.visitType}
                onChange={(e) => setForm({ ...form, visitType: e.target.value })}
              >
                <option value="opd">OPD</option>
                <option value="ipd">IPD</option>
                <option value="emergency">Emergency</option>
                <option value="lab">Lab</option>
              </select>
            </FormField>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 text-sm font-semibold">{t("billing.lineItems")}</h3>
            <div className="space-y-2">
              {items.map((li, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded border border-border p-2"
                >
                  <input
                    placeholder={t("billing.description")}
                    className="col-span-5 rounded border border-border bg-surface px-2 py-1 text-sm"
                    value={li.description}
                    onChange={(e) =>
                      setItems(
                        items.map((x, i) =>
                          i === idx ? { ...x, description: e.target.value } : x
                        )
                      )
                    }
                  />
                  <input
                    type="number"
                    min={1}
                    placeholder="qty"
                    className="col-span-2 rounded border border-border bg-surface px-2 py-1 text-sm"
                    value={li.quantity}
                    onChange={(e) =>
                      setItems(
                        items.map((x, i) =>
                          i === idx ? { ...x, quantity: Number(e.target.value) } : x
                        )
                      )
                    }
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="unit price"
                    className="col-span-3 rounded border border-border bg-surface px-2 py-1 text-sm"
                    value={li.unitPriceLkr}
                    onChange={(e) =>
                      setItems(
                        items.map((x, i) =>
                          i === idx
                            ? { ...x, unitPriceLkr: Number(e.target.value) }
                            : x
                        )
                      )
                    }
                  />
                  <button
                    type="button"
                    className="col-span-2 rounded border border-border bg-surface px-2 py-1 text-sm text-brand-strong"
                    onClick={() => setItems(items.filter((_, i) => i !== idx))}
                  >
                    {t("common.delete")}
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() =>
                setItems([
                  ...items,
                  { description: "", quantity: 1, unitPriceLkr: 0, kind: "other" },
                ])
              }
            >
              + {t("billing.addLine")}
            </Button>
          </div>

          <div className="mt-4 flex justify-end text-sm">
            <div>
              <p className="text-text-muted">{t("billing.subtotal")}</p>
              <p className="text-2xl font-semibold">{formatLkr(subtotal, locale)}</p>
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button type="submit" disabled={create.isPending}>
              {t("common.create")}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              {t("common.cancel")}
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  );
}