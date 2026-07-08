"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FlaskConical, Upload } from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Card } from "@/portal/components/ui/Card";
import { Pill } from "@/portal/components/ui/Pill";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { Empty } from "@/portal/components/ui/Empty";
import { Table, TBody, TD, TH, THead, TR } from "@/portal/components/ui/Table";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import { cn } from "@/portal/lib/utils";

type Tab = "queue" | "completed";

const STATUS_TONES: Record<string, any> = {
  ordered: "warn",
  sample_collected: "info",
  in_progress: "info",
  completed: "success",
};

export default function LabPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("queue");

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("nav.lab")}
        subtitle={t("lab.subtitle")}
      />

      <div className="flex gap-1 border-b border-border">
        {(["queue", "completed"] as Tab[]).map((tt) => (
          <button
            key={tt}
            onClick={() => setTab(tt)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === tt
                ? "border-brand text-brand"
                : "border-transparent text-text-muted hover:text-text"
            )}
          >
            {tt === "queue" ? t("lab.queue") : t("lab.completed")}
          </button>
        ))}
      </div>

      {tab === "queue" ? <Queue /> : <Completed />}
    </div>
  );
}

function Queue() {
  const t = useT();
  const qc = useQueryClient();
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
    <Card padding={false}>
      {queue.isLoading ? (
        <p className="p-5 text-sm text-text-muted">{t("common.loading")}</p>
      ) : list.length === 0 ? (
        <div className="p-5">
          <Empty
            title={t("lab.emptyQueue")}
            icon={<FlaskConical size={28} className="text-text-muted opacity-40" />}
          />
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("common.name")}</TH>
              <TH>{t("lab.test")}</TH>
              <TH>{t("common.status")}</TH>
              <TH> </TH>
            </TR>
          </THead>
          <TBody>
            {list.map((o: any) => (
              <TR key={o.id}>
                <TD className="font-semibold">{o.patientName ?? o.patientId}</TD>
                <TD>{o.testName ?? o.testCode ?? "—"}</TD>
                <TD>
                  <Pill tone={STATUS_TONES[o.status] ?? "neutral"}>{o.status}</Pill>
                </TD>
                <TD>
                  <div className="flex justify-end gap-2">
                    {o.status === "ordered" && (
                      <Button size="sm" variant="ghost" onClick={() => collect.mutate(o.id)}>
                        <CheckCircle2 size={12} className="mr-1" />
                        {t("lab.markCollected")}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setUploadOpen({ id: o.id })}>
                      <Upload size={12} className="mr-1" />
                      {t("lab.uploadResult")}
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
        title={t("lab.uploadResult")}
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (uploadOpen) upload.mutate({ id: uploadOpen.id, result });
          }}
        >
          <FormField label={t("lab.resultText")} required>
            <textarea
              required
              rows={4}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2"
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setUploadOpen(null)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit">{t("common.submit")}</Button>
          </div>
        </Form>
      </Modal>
    </Card>
  );
}

function Completed() {
  const t = useT();
  const q = useQuery({
    queryKey: ["labCompleted"],
    queryFn: () => api<{ labOrders: any[] }>("/labs?status=completed"),
  });

  return (
    <Card padding={false}>
      {q.isLoading ? (
        <p className="p-5 text-sm text-text-muted">{t("common.loading")}</p>
      ) : !q.data?.labOrders?.length ? (
        <div className="p-5">
          <Empty title={t("lab.emptyCompleted")} />
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>{t("common.name")}</TH>
              <TH>{t("lab.test")}</TH>
              <TH>{t("lab.completedAt")}</TH>
            </TR>
          </THead>
          <TBody>
            {q.data.labOrders.map((o: any) => (
              <TR key={o.id}>
                <TD className="font-semibold">{o.patientName ?? o.patientId}</TD>
                <TD>{o.testName ?? o.testCode ?? "—"}</TD>
                <TD className="text-text-muted">{o.completedAt ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}