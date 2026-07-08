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
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useAuthStore } from "@/hospital/stores/auth";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { formatDate } from "@/hospital/lib/format";

export default function StaffInvitesPage() {
  const t = useT();
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    role: "hospital_staff",
    departmentId: "",
  });

  const list = useQuery({
    queryKey: ["staffInvites"],
    queryFn: () => api<{ invites: any[] }>("/hospital-portal/staff/invites"),
  });

  const create = useMutation({
    mutationFn: (body: any) =>
      api("/hospital-portal/staff/invites", { method: "POST", json: body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staffInvites"] });
      setOpen(false);
      setForm({ email: "", name: "", role: "hospital_staff", departmentId: "" });
      toast.success("Invite created");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const revoke = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-portal/staff/invites/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staffInvites"] }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.staffInvites")}
        actions={
          <Button onClick={() => setOpen(true)}>+ {t("staff.inviteStaff")}</Button>
        }
      />

      <Card>
        {list.isLoading ? (
          <p className="text-sm text-text-muted">{t("common.loading")}</p>
        ) : !list.data?.invites?.length ? (
          <Empty title={t("staff.noInvites")} />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>{t("common.email")}</TH>
                <TH>{t("common.name")}</TH>
                <TH>{t("staff.role")}</TH>
                <TH>{t("common.status")}</TH>
                <TH>{t("common.date")}</TH>
                <TH> </TH>
              </TR>
            </THead>
            <TBody>
              {list.data.invites.map((i: any) => (
                <TR key={i.id}>
                  <TD>{i.email}</TD>
                  <TD>{i.name ?? "—"}</TD>
                  <TD>{i.role}</TD>
                  <TD>
                    <Pill tone={i.acceptedAt ? "success" : i.revokedAt ? "neutral" : "warn"}>
                      {i.acceptedAt ? "accepted" : i.revokedAt ? "revoked" : "pending"}
                    </Pill>
                  </TD>
                  <TD>{formatDate(i.createdAt, locale)}</TD>
                  <TD>
                    {!i.acceptedAt && !i.revokedAt && (
                      <Button size="sm" variant="ghost" onClick={() => revoke.mutate(i.id)}>
                        {t("common.delete")}
                      </Button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title={t("staff.inviteStaff")}>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate({
              ...form,
              departmentId: form.departmentId || null,
            });
          }}
        >
          <FormField label={t("common.email")} required>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label={t("common.name")}>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </FormField>
          <FormField label={t("staff.role")}>
            <select
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              <option value="hospital_admin">Hospital Admin</option>
              <option value="hospital_staff">Hospital Staff</option>
              <option value="doctor">Doctor</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="laboratory">Laboratory</option>
            </select>
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.submit")}</Button>
          </div>
        </Form>
      </Modal>
    </div>
  );
}