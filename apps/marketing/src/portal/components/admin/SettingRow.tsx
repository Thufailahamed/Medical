"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Save, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";

type ValueType = "string" | "number" | "boolean" | "json";

export interface SettingItem {
  key: string;
  value: unknown;
  valueType: ValueType;
  category: string;
  description: string;
  isSensitive: boolean;
  updatedAt: string;
  updatedByUserId: string | null;
}

function ValueInput({
  value,
  valueType,
  onChange,
}: {
  value: unknown;
  valueType: ValueType;
  onChange: (v: unknown) => void;
}) {
  if (valueType === "boolean") {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-amber-600"
        />
        <span className="text-sm font-mono">{value ? "true" : "false"}</span>
      </label>
    );
  }
  if (valueType === "number") {
    return (
      <input
        type="number"
        value={typeof value === "number" ? value : Number(value) || 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-40 h-9 px-3 rounded-lg border border-border bg-surface text-sm font-mono"
      />
    );
  }
  if (valueType === "string") {
    return (
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-72 h-9 px-3 rounded-lg border border-border bg-surface text-sm font-mono"
      />
    );
  }
  // json
  return (
    <textarea
      defaultValue={JSON.stringify(value, null, 2)}
      onBlur={(e) => {
        try {
          onChange(JSON.parse(e.target.value));
        } catch {
          // ignore parse errors — UI shows toast on save attempt
        }
      }}
      className="w-72 h-24 px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono resize-none"
    />
  );
}

export function SettingRow({ item }: { item: SettingItem }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<unknown>(item.value);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  const dirty = JSON.stringify(draft) !== JSON.stringify(item.value);

  const mut = useMutation({
    mutationFn: async (body: { value: unknown; confirm?: boolean }) => {
      return adminApi(`/admin/settings/${encodeURIComponent(item.key)}`, {
        method: "PATCH",
        json: body,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQk.settings() });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    },
    onError: () => {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    },
  });

  function handleSave() {
    if (item.isSensitive) {
      setConfirmOpen(true);
      return;
    }
    mut.mutate({ value: draft });
  }

  function handleConfirmedSave() {
    setConfirmOpen(false);
    mut.mutate({ value: draft, confirm: true });
  }

  return (
    <div className="flex items-start gap-4 py-3 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold">{item.key}</span>
          {item.isSensitive ? (
            <span title="Sensitive — confirm before save" className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-amber-700">
              <AlertTriangle size={11} /> sensitive
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-text-soft">{item.description}</p>
        <p className="mt-1 text-[11px] text-text-muted">
          Last updated {new Date(item.updatedAt).toLocaleString()}
        </p>
      </div>
      <div className="flex-shrink-0">
        <ValueInput value={draft} valueType={item.valueType} onChange={setDraft} />
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!dirty || mut.isPending}
          className="gap-1"
        >
          {mut.isPending ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Save size={12} />
          )}
          Save
        </Button>
        {status === "saved" ? (
          <CheckCircle2 size={14} className="text-emerald-600" />
        ) : null}
        {status === "error" ? (
          <AlertTriangle size={14} className="text-red-600" />
        ) : null}
      </div>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Confirm change to ${item.key}`}
        subtitle={item.description}
        size="md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmedSave} className="bg-amber-600 hover:bg-amber-700 text-white">
              Confirm and save
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            This is a sensitive setting. The change takes effect immediately and
            cannot be undone from this UI.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="text-xs uppercase tracking-widest text-amber-700 font-semibold">
              Before
            </div>
            <pre className="mt-1 text-xs font-mono text-amber-900">
              {JSON.stringify(item.value, null, 2)}
            </pre>
            <div className="mt-3 text-xs uppercase tracking-widest text-amber-700 font-semibold">
              After
            </div>
            <pre className="mt-1 text-xs font-mono text-amber-900">
              {JSON.stringify(draft, null, 2)}
            </pre>
          </div>
        </div>
      </Modal>
    </div>
  );
}