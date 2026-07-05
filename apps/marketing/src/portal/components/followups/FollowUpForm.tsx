"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea } from "@/portal/components/ui/Form";
import { toast } from "@/portal/components/ui/Toast";

interface Props {
  patientId: string;
  onSaved?: (id: string) => void;
  onCancel?: () => void;
}

function defaultDate() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString().slice(0, 10);
}

export function FollowUpForm({ patientId, onSaved, onCancel }: Props) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(defaultDate());
  const [notes, setNotes] = useState("");

  const save = useMutation({
    mutationFn: () =>
      api<{ record: { id: string } }>("/doctor-portal/follow-ups", {
        method: "POST",
        json: {
          patientId,
          title: title.trim(),
          followUpDate: date,
          notes: notes || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success("Follow-up scheduled", `#${res.record?.id}`);
      qc.invalidateQueries({ queryKey: ["doctor-portal", "follow-ups"] });
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
        placeholder="e.g. BP review in 2 weeks"
        required
      />
      <Input
        type="date"
        label="Follow-up date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        required
      />
      <Textarea
        label="Notes (optional)"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="What should the patient bring / expect"
      />
      <div className="flex justify-end gap-2 sticky bottom-0 bg-bg py-2">
        {onCancel ? (
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          leftIcon={<Save size={14} />}
          disabled={save.isPending || !title.trim() || !date}
          loading={save.isPending}
          onClick={() => save.mutate()}
        >
          Schedule
        </Button>
      </div>
    </div>
  );
}