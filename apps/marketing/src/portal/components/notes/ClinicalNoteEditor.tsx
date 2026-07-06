"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { api, qk } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";

interface Props {
  patientId: string;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

export function ClinicalNoteEditor({ patientId, onSaved, onCancel }: Props) {
  const t = useT();
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [s, setS] = useState("");
  const [o, setO] = useState("");
  const [a, setA] = useState("");
  const [p, setP] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const combined = [
        s && `S: ${s}`,
        o && `O: ${o}`,
        a && `A: ${a}`,
        p && `P: ${p}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      return api<{ record: { id: string } }>("/doctor-portal/clinical-notes", {
        method: "POST",
        json: {
          patientId,
          title: title.trim(),
          diagnosis: diagnosis.trim() || undefined,
          notes: combined || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Note saved", `#${res.record?.id}`);
      qc.invalidateQueries({ queryKey: ["doctor-portal", "clinical-notes"] });
      qc.invalidateQueries({ queryKey: qk.patientOverview(patientId) });
      onSaved?.(res.record?.id);
    },
    onError: (err: any) => toast.error("Failed", err?.message),
  });

  return (
    <div className="flex flex-col gap-3">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Visit — 2026-07-05"
        required
      />
      <Input
        label="Diagnosis (optional)"
        value={diagnosis}
        onChange={(e) => setDiagnosis(e.target.value)}
        placeholder="e.g. Acute pharyngitis"
      />
      <Textarea
        label="Subjective"
        value={s}
        onChange={(e) => setS(e.target.value)}
        rows={2}
        placeholder="Patient's reported symptoms & history"
      />
      <Textarea
        label="Objective"
        value={o}
        onChange={(e) => setO(e.target.value)}
        rows={2}
        placeholder="Exam findings, vitals, labs reviewed"
      />
      <Textarea
        label="Assessment"
        value={a}
        onChange={(e) => setA(e.target.value)}
        rows={2}
        placeholder="Clinical impression"
      />
      <Textarea
        label="Plan"
        value={p}
        onChange={(e) => setP(e.target.value)}
        rows={3}
        placeholder="Treatment plan, prescriptions, follow-up"
      />

      <div className="flex justify-end gap-2 sticky bottom-0 bg-bg py-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          leftIcon={<Save size={14} />}
          disabled={save.isPending || title.trim().length === 0}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Save note
        </Button>
      </div>
    </div>
  );
}