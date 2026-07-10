"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea, Select } from "@/portal/components/ui/Form";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";

interface Props {
  patientId: string;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

const COMMON_TESTS = [
  "CBC",
  "FBS",
  "HbA1c",
  "Lipid profile",
  "LFT",
  "RFT / Serum creatinine",
  "TSH",
  "Urine full report",
  "ESR",
  "CRP",
  "Dengue NS1",
  "Blood grouping & Rh",
];

const PRIORITY_OPTIONS = [
  { value: "routine", label: "Routine" },
  { value: "urgent", label: "Urgent" },
  { value: "stat", label: "STAT (immediate)" },
];

export function LabOrderForm({ patientId, onSaved, onCancel }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [tests, setTests] = useState<string[]>([""]);
  const [priority, setPriority] = useState("routine");
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api<{ order: { id: string } }>("/doctor-portal/lab-orders", {
        method: "POST",
        json: {
          patientId,
          priority,
          tests: tests.filter((x) => x.trim()),
          notes: notes || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success("Lab order placed", `#${res.order?.id}`);
      qc.invalidateQueries({ queryKey: ["doctor-portal", "lab-orders"] });
      qc.invalidateQueries({ queryKey: ["doctor-portal", "lab-orders-all"] });
      qc.invalidateQueries({ queryKey: qk.patientOverview(patientId) });
      onSaved?.(res.order?.id);
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  function setTest(i: number, v: string) {
    setTests((arr) => arr.map((x, idx) => (idx === i ? v : x)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block text-[11px] text-text-soft mb-1">Tests</label>
        <div className="flex flex-col gap-2">
          {tests.map((v, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={v}
                onChange={(e) => setTest(i, e.target.value)}
                placeholder="e.g. CBC"
                list="common-tests"
              />
              <button
                type="button"
                onClick={() => setTests((arr) => arr.filter((_, idx) => idx !== i))}
                disabled={tests.length === 1}
                className="px-2 text-text-muted hover:text-danger disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <datalist id="common-tests">
            {COMMON_TESTS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        <Button
          size="sm"
          variant="ghost"
          leftIcon={<Plus size={12} />}
          onClick={() => setTests((arr) => [...arr, ""])}
          className="mt-2"
        >
          Add test
        </Button>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {COMMON_TESTS.slice(0, 6).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setTests((arr) => (arr.includes(c) ? arr : [...arr, c]));
              }}
              className="text-[10px]"
            >
              <Pill tone="neutral" className="cursor-pointer">
                + {c}
              </Pill>
            </button>
          ))}
        </div>
      </div>

      <Select
        label="Priority"
        value={priority}
        onChange={(e) => setPriority(e.target.value)}
        options={PRIORITY_OPTIONS}
      />

      <Textarea
        label="Clinical notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="Brief clinical context for the lab"
      />

      <Card padding={false}>
        <div className="px-3 py-2 text-[11px] text-text-soft border-b border-border">
          Preview ({tests.filter((x) => x.trim()).length} test(s))
        </div>
        <div className="px-3 py-2 flex flex-wrap gap-1.5">
          {tests.filter((x) => x.trim()).map((x, i) => (
            <Pill key={i} tone={priority === "urgent" ? "danger" : priority === "stat" ? "danger" : "brand"}>
              {x}
            </Pill>
          ))}
        </div>
      </Card>

      <div className="flex justify-end gap-2 sticky bottom-0 bg-bg py-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          leftIcon={<Save size={14} />}
          disabled={save.isPending || tests.filter((x) => x.trim()).length === 0}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Place order
        </Button>
      </div>
    </div>
  );
}