"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Plus, Trash2, Edit2, Save } from "lucide-react";
import { format, parseISO } from "date-fns";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { Drawer } from "@/portal/components/ui/Modal";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";

interface Template {
  id: string;
  name: string;
  description?: string | null;
  diagnosis?: string | null;
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    timing?: string;
    duration?: string;
  }>;
  useCount?: number;
  updatedAt?: string;
}

interface Page<T> {
  templates?: T[];
  items?: T[];
}

export default function TemplatesPage() {
  const t = useT();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-rx-templates"],
    queryFn: () => api<Page<Template>>(`/doctor-rx-templates`),
  });

  const list: Template[] = (data?.templates ?? data?.items ?? []) as Template[];

  const del = useMutation({
    mutationFn: (id: string) =>
      api(`/doctor-rx-templates/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Template deleted");
      qc.invalidateQueries({ queryKey: ["doctor-rx-templates"] });
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text">{t("templates.title")}</h1>
          <p className="text-sm text-text-soft mt-1">{t("templates.subtitle")}</p>
        </div>
        <Button
          size="sm"
          leftIcon={<Plus size={14} />}
          onClick={() => setCreating(true)}
        >
          {t("templates.new")}
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full mt-2" />
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <Empty title={t("templates.empty")} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {list.map((tmpl) => (
            <Card key={tmpl.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text truncate">
                      {tmpl.name}
                    </h3>
                    {tmpl.useCount ? (
                      <Pill tone="brand">Used {tmpl.useCount}×</Pill>
                    ) : null}
                  </div>
                  {tmpl.diagnosis ? (
                    <div className="text-[11px] text-text-soft mt-0.5">
                      {tmpl.diagnosis}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Edit2 size={12} />}
                    onClick={() => setEditing(tmpl)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    leftIcon={<Trash2 size={12} />}
                    onClick={() => {
                      if (confirm(`Delete ${tmpl.name}?`)) del.mutate(tmpl.id);
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
              {tmpl.description ? (
                <div className="text-xs text-text-soft mt-2 line-clamp-2">
                  {tmpl.description}
                </div>
              ) : null}
              <ul className="mt-3 flex flex-col gap-1">
                {(tmpl.medicines ?? []).slice(0, 5).map((m, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-[11px] text-text"
                  >
                    <Copy size={11} className="text-text-muted" />
                    <span className="truncate">
                      {m.name} {m.dosage ? `· ${m.dosage}` : ""}{" "}
                      {m.frequency ? `· ${m.frequency}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              {tmpl.updatedAt ? (
                <div className="text-[10px] text-text-muted mt-2">
                  Updated {format(parseISO(tmpl.updatedAt), "MMM d, yyyy")}
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <Drawer
        open={creating || !!editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit · ${editing.name}` : "New template"}
        size="lg"
      >
        <TemplateForm
          template={editing}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["doctor-rx-templates"] });
          }}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      </Drawer>
    </div>
  );
}

function TemplateForm({
  template,
  onSaved,
  onCancel,
}: {
  template: Template | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template?.name ?? "");
  const [diagnosis, setDiagnosis] = useState(template?.diagnosis ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [meds, setMeds] = useState(
    template?.medicines?.length
      ? template.medicines.map((m) => ({
          name: m.name,
          dosage: m.dosage ?? "",
          frequency: m.frequency ?? "",
          timing: m.timing ?? "",
          duration: m.duration ?? "",
        }))
      : [{ name: "", dosage: "", frequency: "", timing: "", duration: "" }]
  );

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name,
        diagnosis,
        description,
        medicines: meds.filter((m) => m.name.trim()),
      };
      if (template?.id) {
        return api(`/doctor-rx-templates/${template.id}`, {
          method: "PATCH",
          json: body,
        });
      }
      return api(`/doctor-rx-templates`, { method: "POST", json: body });
    },
    onSuccess: () => {
      toast.success(template?.id ? "Updated" : "Created");
      onSaved();
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Template name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="e.g. Strep throat — adult"
        required
      />
      <Input
        label="Default diagnosis"
        value={diagnosis}
        onChange={(e) => setDiagnosis(e.target.value)}
        placeholder="e.g. Acute pharyngitis"
      />
      <Textarea
        label="Description (internal note)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
      />

      <div className="flex flex-col gap-2">
        {meds.map((m, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-4">
              <Input
                value={m.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, name: v } : x)));
                }}
                placeholder="Medicine"
              />
            </div>
            <div className="col-span-2">
              <Input
                value={m.dosage}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, dosage: v } : x)));
                }}
                placeholder="500 mg"
              />
            </div>
            <div className="col-span-2">
              <Input
                value={m.frequency}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, frequency: v } : x)));
                }}
                placeholder="BD"
              />
            </div>
            <div className="col-span-3">
              <Input
                value={m.duration}
                onChange={(e) => {
                  const v = e.target.value;
                  setMeds((arr) => arr.map((x, idx) => (idx === i ? { ...x, duration: v } : x)));
                }}
                placeholder="5 days"
              />
            </div>
            <button
              type="button"
              onClick={() => setMeds((arr) => arr.filter((_, idx) => idx !== i))}
              className="col-span-1 h-8 text-text-muted hover:text-danger"
              disabled={meds.length === 1}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<Plus size={12} />}
          onClick={() =>
            setMeds((arr) => [
              ...arr,
              { name: "", dosage: "", frequency: "", timing: "", duration: "" },
            ])
          }
        >
          Add medicine
        </Button>
      </div>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-bg py-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          leftIcon={<Save size={14} />}
          disabled={!name.trim() || save.isPending}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}