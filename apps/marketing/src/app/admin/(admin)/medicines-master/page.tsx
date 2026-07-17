"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus, Pencil } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  id: string;
  genericName: string;
  brandName: string | null;
  strength: string | null;
  scheduleClass: string | null;
  isGeneric: boolean | null;
  active: boolean | null;
  notes: string | null;
};

type FormState = {
  genericName: string;
  brandName: string;
  strength: string;
  scheduleClass: string;
  isGeneric: boolean;
  active: boolean;
};

const EMPTY: FormState = {
  genericName: "",
  brandName: "",
  strength: "",
  scheduleClass: "",
  isGeneric: true,
  active: true,
};

export default function AdminMedicinesMasterPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data, isLoading } = useQuery({
    queryKey: adminQk.medicinesMaster({ q }),
    queryFn: () => {
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      qs.set("limit", "200");
      return adminApi<{ items: Row[]; total: number }>(`/admin/medicines-master?${qs.toString()}`);
    },
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        genericName: form.genericName,
        brandName: form.brandName || null,
        strength: form.strength || null,
        scheduleClass: form.scheduleClass || null,
        isGeneric: form.isGeneric,
        active: form.active,
      };
      if (editing) {
        return adminApiWithStepUp(`/admin/medicines-master/${editing.id}`, {
          method: "PATCH",
          json: payload,
        });
      }
      return adminApiWithStepUp(`/admin/medicines-master`, {
        method: "POST",
        json: payload,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Updated" : "Created");
      qc.invalidateQueries({ queryKey: ["admin", "medicines-master"] });
      setEditing(null);
      setCreating(false);
      setForm(EMPTY);
    },
    onError: (e: any) => toast.error("Save failed", e.message),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setCreating(true);
  }
  function openEdit(row: Row) {
    setEditing(row);
    setForm({
      genericName: row.genericName,
      brandName: row.brandName ?? "",
      strength: row.strength ?? "",
      scheduleClass: row.scheduleClass ?? "",
      isGeneric: row.isGeneric ?? true,
      active: row.active ?? true,
    });
  }

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Medicines master catalogue"
        subtitle={`${data?.total ?? 0} rows`}
        icon={<BookOpen size={20} className="text-amber-600" />}
        actions={
          <Button onClick={openCreate} className="bg-amber-600 hover:bg-amber-700">
            <Plus size={14} className="mr-1" />Add medicine
          </Button>
        }
      />

      <div className="flex items-center gap-2">
        <Input
          placeholder="Search generic or brand"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-72 h-9"
        />
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
          No medicines.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Generic</TH>
              <TH>Brand</TH>
              <TH>Strength</TH>
              <TH>Schedule</TH>
              <TH>Type</TH>
              <TH>Status</TH>
              <TH><span className="sr-only">Actions</span></TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((m) => (
              <TR key={m.id}>
                <TD className="font-semibold text-sm">{m.genericName}</TD>
                <TD className="text-xs">{m.brandName || "—"}</TD>
                <TD className="text-xs">{m.strength || "—"}</TD>
                <TD><Pill>{m.scheduleClass || "—"}</Pill></TD>
                <TD className="text-xs">{m.isGeneric ? "Generic" : "Brand"}</TD>
                <TD>{m.active ? <Pill tone="success">active</Pill> : <Pill tone="danger">inactive</Pill>}</TD>
                <TD>
                  <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                    <Pencil size={14} />
                  </Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={creating || !!editing}
        onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? "Edit medicine" : "New medicine"}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setCreating(false); setEditing(null); }}>
              Cancel
            </Button>
            <Button
              loading={save.isPending}
              onClick={() => save.mutate()}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {editing ? "Save" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Generic name" required>
            <Input
              value={form.genericName}
              onChange={(e) => setForm({ ...form, genericName: e.target.value })}
            />
          </Field>
          <Field label="Brand name">
            <Input
              value={form.brandName}
              onChange={(e) => setForm({ ...form, brandName: e.target.value })}
            />
          </Field>
          <Field label="Strength">
            <Input
              value={form.strength}
              onChange={(e) => setForm({ ...form, strength: e.target.value })}
            />
          </Field>
          <Field label="Schedule class">
            <Input
              value={form.scheduleClass}
              onChange={(e) => setForm({ ...form, scheduleClass: e.target.value })}
            />
          </Field>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isGeneric}
                onChange={(e) => setForm({ ...form, isGeneric: e.target.checked })}
              />
              Generic
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              Active
            </label>
          </div>
        </div>
      </Modal>
    </div>
  );
}