"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Stethoscope, Plus } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Empty, Skeleton } from "@/portal/components/ui/Empty";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { ClinicalNoteEditor } from "@/portal/components/notes/ClinicalNoteEditor";
import { useT } from "@/portal/i18n";
import { formatDateTime } from "@/portal/lib/format";

interface ClinicalNote {
  id: string;
  patientId: string;
  patient?: { id: string; name: string } | null;
  title: string;
  diagnosis?: string | null;
  notes?: string | null;
  createdAt?: string;
}

interface NotesResponse {
  notes: ClinicalNote[];
  count: number;
}

export default function ClinicalNotesTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useT();
  const [open, setOpen] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "clinical-notes", "all"],
    queryFn: () => api<NotesResponse>(`/doctor-portal/clinical-notes?limit=200`),
  });
  const rows = (data?.notes ?? []).filter((n) => n.patientId === id);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setOpen(true)}>
          {t("notes.newNote")}
        </Button>
      </div>
      <Card>
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <Empty title={t("notes.empty")} />
        ) : (
          <ul className="flex flex-col">
            {rows.map((n) => (
              <li key={n.id} className="border-b border-border last:border-0 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Stethoscope size={14} className="text-text-soft" />
                  <span className="text-sm font-medium text-text">{n.title}</span>
                  {n.createdAt ? (
                    <span className="text-xs text-text-muted ml-auto">
                      {formatDateTime(n.createdAt)}
                    </span>
                  ) : null}
                </div>
                {n.diagnosis ? (
                  <div className="text-xs text-text mb-1">
                    <span className="text-text-muted">Dx:</span> {n.diagnosis}
                  </div>
                ) : null}
                {n.notes ? (
                  <div className="text-xs text-text-soft whitespace-pre-wrap mt-1">
                    {n.notes}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title={t("notes.newNote")}
        size="xl"
      >
        <ClinicalNoteEditor
          patientId={id}
          onSaved={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </Drawer>
    </div>
  );
}