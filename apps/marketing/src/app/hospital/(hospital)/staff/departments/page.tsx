"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { Empty } from "@/portal/components/ui/Empty";
import { useAuthStore } from "@/hospital/stores/auth";
import { tr } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";

export default function DepartmentsPage() {
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "" });

  const list = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<{ departments: any[] }>("/hospital-portal/departments"),
  });

  const create = useMutation({
    mutationFn: (body: any) =>
      api("/hospital-portal/departments", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["departments"] });
      setOpen(false);
      setForm({ name: "" });
      toast.success("Department created");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const remove = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-portal/departments/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["departments"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.departments")}
        actions={
          <Button onClick={() => setOpen(true)}>+ {tr(locale, "departments.new")}</Button>
        }
      />

      {!list.data?.departments?.length ? (
        <Empty title={tr(locale, "departments.empty")} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.data.departments.map((d: any) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {d.headDoctorName ?? tr(locale, "departments.noHead")}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Pill tone={d.active ? "success" : "neutral"}>
                    {d.active ? "active" : "inactive"}
                  </Pill>
                  {!d.active ? null : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove.mutate(d.id)}
                    >
                      {tr(locale, "common.delete")}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={tr(locale, "departments.new")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
        >
          <FormField label={tr(locale, "common.name")} required>
            <input
              required
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
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