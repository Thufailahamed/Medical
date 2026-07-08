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
import { tr } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";

type Tab = "queue" | "completed";

export default function LabPage() {
  const locale = useAuthStore((s) => s.locale);
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div className="space-y-6">
      <PageHeader
        title={tr(locale, "nav.lab")}
        subtitle={tr(locale, "lab.subtitle")}
      />

      <div className="flex gap-2 border-b border-[var(--border)]">
        <button
          onClick={() => setTab("queue")}
          className={`border-b-2 px-4 py-2 text-sm ${
            tab === "queue"
              ? "border-[var(--accent-600)] font-semibold"
              : "border-transparent text-[var(--text-muted)]"
          }`}
        >
          {tr(locale, "lab.queue")}
        </button>
        <button
          onClick={() => setTab("completed")}
          className={`border-b-2 px-4 py-2 text-sm ${
            tab === "completed"
              ? "border-[var(--accent-600)] font-semibold"
              : "border-transparent text-[var(--text-muted)]"
          }`}
        >
          {tr(locale, "lab.completed")}
        </button>
      </div>

      {tab === "queue" ? <Queue /> : <Completed />}
    </div>
  );
}

function Queue() {
  const qc = useQueryClient();
  const locale = useAuthStore((s) => s.locale);
  const [uploadOpen, setUploadOpen] = useState<{ id: string } | null>(null);
  const [result, setResult] = useState("");

  const queue = useQuery({
    queryKey: ["labQueue"],
    queryFn: () =>
      api<{ labOrders: any[] }>(
        "/labs?status=ordered,sample_collected,in_progress"
      ),
    refetchInterval: 30_000,
  });

  const upload = useMutation({
    mutationFn: ({ id, result }: { id: string; result: string }) =>
      api(`/labs/${id}/result`, {
        method: "POST",
        json: { resultText: result },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["labQueue"] });
      setUploadOpen(null);
      setResult("");
      toast.success("Result uploaded");
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  const collect = useMutation({
    mutationFn: (id: string) =>
      api(`/labs/${id}/sample-collected`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["labQueue"] }),
  });

  const list = queue.data?.labOrders ?? [];

  return (
    <Card>
      {queue.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
      ) : list.length === 0 ? (
        <Empty title={tr(locale, "lab.emptyQueue")} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{tr(locale, "common.name")}</TH>
              <TH>{tr(locale, "lab.test")}</TH>
              <TH>{tr(locale, "common.status")}</TH>
              <TH> </TH>
            </TR>
          </THead>
          <TBody>
            {list.map((o: any) => (
              <TR key={o.id}>
                <TD>{o.patientName ?? o.patientId}</TD>
                <TD>{o.testName ?? o.testCode ?? "—"}</TD>
                <TD>
                  <Pill tone="warn">{o.status}</Pill>
                </TD>
                <TD>
                  <div className="flex gap-2">
                    {o.status === "ordered" && (
                      <Button size="sm" variant="ghost" onClick={() => collect.mutate(o.id)}>
                        {tr(locale, "lab.markCollected")}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setUploadOpen({ id: o.id })}>
                      {tr(locale, "lab.uploadResult")}
                    </Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={!!uploadOpen}
        onClose={() => setUploadOpen(null)}
        title={tr(locale, "lab.uploadResult")}
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (uploadOpen) upload.mutate({ id: uploadOpen.id, result });
          }}
        >
          <FormField label={tr(locale, "lab.resultText")} required>
            <textarea
              required
              rows={4}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-3 py-2"
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setUploadOpen(null)}>
              {tr(locale, "common.cancel")}
            </Button>
            <Button type="submit">{tr(locale, "common.submit")}</Button>
          </div>
        </Form>
      </Modal>
    </Card>
  );
}

function Completed() {
  const locale = useAuthStore((s) => s.locale);
  const q = useQuery({
    queryKey: ["labCompleted"],
    queryFn: () => api<{ labOrders: any[] }>("/labs?status=completed"),
  });

  return (
    <Card>
      {q.isLoading ? (
        <p className="text-sm text-[var(--text-muted)]">{tr(locale, "common.loading")}</p>
      ) : !q.data?.labOrders?.length ? (
        <Empty title={tr(locale, "lab.emptyCompleted")} />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{tr(locale, "common.name")}</TH>
              <TH>{tr(locale, "lab.test")}</TH>
              <TH>{tr(locale, "lab.completedAt")}</TH>
            </TR>
          </THead>
          <TBody>
            {q.data.labOrders.map((o: any) => (
              <TR key={o.id}>
                <TD>{o.patientName ?? o.patientId}</TD>
                <TD>{o.testName ?? o.testCode ?? "—"}</TD>
                <TD>{o.completedAt ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}