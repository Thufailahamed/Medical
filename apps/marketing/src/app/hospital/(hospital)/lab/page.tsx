"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FlaskConical,
  Pill,
  RefreshCw,
  TestTube,
  Upload,
} from "lucide-react";
import { api } from "@/hospital/lib/api";
import { Modal } from "@/portal/components/ui/Modal";
import { Form, FormField } from "@/hospital/components/ui/LocalForm";
import { useT } from "@/hospital/i18n";
import { toast } from "@/portal/components/ui/Toast";
import {
  DoctorHero,
  EmptyBlock,
  HERO_CHIP,
  HERO_GHOST,
  HeroOverlap,
  PANEL,
  PanelHeader,
  PRIMARY_BTN,
  SECONDARY_BTN,
  Segmented,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import {
  FIELD_TEXTAREA,
  HeroPulse,
  QuickToolsPanel,
  RailRow,
  TONE_BADGE,
} from "@/patient/components/workspace";
import { cn } from "@/portal/lib/utils";

type Tab = "queue" | "completed";

type LabOrder = {
  id: string;
  patientName?: string | null;
  patientId?: string;
  testName?: string | null;
  testCode?: string | null;
  status?: string;
  completedAt?: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  ordered: TONE_BADGE.amber,
  sample_collected: TONE_BADGE.sky,
  in_progress: TONE_BADGE.sky,
  completed: TONE_BADGE.emerald,
  cancelled: TONE_BADGE.rose,
};

const STATUS_RAIL: Record<string, "amber" | "sky" | "emerald" | "rose" | "slate"> = {
  ordered: "amber",
  sample_collected: "sky",
  in_progress: "sky",
  completed: "emerald",
  cancelled: "rose",
};

export default function LabPage() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");

  const queue = useQuery({
    queryKey: ["labQueue"],
    queryFn: () =>
      api<{ labOrders: LabOrder[] }>(
        "/labs?status=ordered,sample_collected,in_progress"
      ),
    refetchInterval: 30_000,
  });

  const completed = useQuery({
    queryKey: ["labCompleted"],
    queryFn: () => api<{ labOrders: LabOrder[] }>("/labs?status=completed"),
  });

  const queueList = queue.data?.labOrders ?? [];
  const completedList = completed.data?.labOrders ?? [];
  const awaitingSample = queueList.filter((o) => o.status === "ordered").length;
  const inProgress = queueList.filter((o) => o.status === "in_progress" || o.status === "sample_collected").length;

  const hero = (
    <DoctorHero
      kickerIcon={<FlaskConical size={13} aria-hidden />}
      kicker={t("nav.lab")}
      kickerMeta={tab === "queue" ? t("lab.queue") : t("lab.completed")}
      title={
        <>
          {t("nav.labOrders")}{" "}
          <span className="bg-gradient-to-r from-violet-200 via-white to-fuchsia-200 bg-clip-text text-transparent">
            · {tab}
          </span>
        </>
      }
      description={t("lab.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <TestTube size={12} className="text-amber-300" />
            {awaitingSample} awaiting sample
          </span>
          <span className={HERO_CHIP}>
            <FlaskConical size={12} className="text-sky-300" />
            {inProgress} in progress
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<FlaskConical size={18} />}
          label={t("lab.queue")}
          value={queue.isLoading ? "…" : queueList.length}
          sub={`${completedList.length} ${t("lab.completed").toLowerCase()}`}
        />
      }
      actions={
        <button
          type="button"
          onClick={() => {
            queue.refetch();
            completed.refetch();
          }}
          className={HERO_GHOST}
        >
          <RefreshCw
            size={13}
            className={queue.isFetching || completed.isFetching ? "animate-spin" : ""}
          />
          {t("common.refresh")}
        </button>
      }
    />
  );

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10">
      {hero}

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<FlaskConical size={16} />}
          tone="bg-amber-50 text-amber-600"
          label={t("lab.queue")}
          value={queue.isLoading ? "…" : String(queueList.length)}
          sub="Ordered → in progress"
          active={tab === "queue"}
          onClick={() => setTab("queue")}
          pulse={queueList.length > 0}
        />
        <StatTile
          icon={<TestTube size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Awaiting sample"
          value={queue.isLoading ? "…" : String(awaitingSample)}
          sub="Need collection first"
          active={tab === "queue"}
          onClick={() => setTab("queue")}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("lab.completed")}
          value={completed.isLoading ? "…" : String(completedList.length)}
          sub="Results uploaded"
          active={tab === "completed"}
          onClick={() => setTab("completed")}
        />
        <StatTile
          icon={<Pill size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.pharmacyQueue")}
          value="→"
          sub={t("pharmacy.subtitle")}
          href="/hospital/pharmacy"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-9">
          <Segmented<Tab>
            ariaLabel="Lab order sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: "queue", label: t("lab.queue"), count: queueList.length },
              { value: "completed", label: t("lab.completed"), count: completedList.length },
            ]}
          />

          <div className="mt-5">
            {tab === "queue" ? (
              <QueuePanel
                list={queueList}
                isLoading={queue.isLoading}
                onChanged={() => qc.invalidateQueries({ queryKey: ["labQueue"] })}
              />
            ) : (
              <CompletedPanel list={completedList} isLoading={completed.isLoading} />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-3">
          <QuickToolsPanel
            id="lab-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: Pill,
                label: t("nav.pharmacyQueue"),
                hint: "Dispense",
                href: "/hospital/pharmacy",
                tone: "from-rose-500 to-pink-600 shadow-rose-500/30",
              },
              {
                icon: FlaskConical,
                label: t("nav.ipd"),
                hint: "Census",
                href: "/hospital/ipd",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: TestTube,
                label: t("nav.dashboard"),
                hint: "Overview",
                href: "/hospital/dashboard",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<TestTube size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Turnaround"
              caption="Collect sample → process → upload result"
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Orders marked <em>ordered</em> need a sample first — mark it
              collected, then upload the result to complete the order.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function QueuePanel({
  list,
  isLoading,
  onChanged,
}: {
  list: LabOrder[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [uploadOpen, setUploadOpen] = useState<{ id: string } | null>(null);
  const [result, setResult] = useState("");

  const upload = useMutation({
    mutationFn: ({ id, result }: { id: string; result: string }) =>
      api(`/labs/${id}/result`, {
        method: "POST",
        json: { resultText: result },
      }),
    onSuccess: () => {
      onChanged();
      setUploadOpen(null);
      setResult("");
      toast.success("Result uploaded");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const collect = useMutation({
    mutationFn: (id: string) =>
      api(`/labs/${id}/sample-collected`, { method: "POST" }),
    onSuccess: () => onChanged(),
  });

  return (
    <section className={PANEL}>
      <PanelHeader
        icon={<FlaskConical size={16} />}
        tone="bg-amber-50 text-amber-600"
        title={t("lab.queue")}
        caption={`${list.length} open`}
      />
      {isLoading ? (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyBlock
          icon={<FlaskConical size={19} />}
          title={t("lab.emptyQueue")}
          body="New lab orders from doctors will appear here."
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {list.map((o) => (
            <li key={o.id}>
              <RailRow
                tone={STATUS_RAIL[o.status ?? ""] ?? "slate"}
                icon={<TestTube size={16} />}
                title={o.patientName ?? o.patientId ?? "—"}
                meta={o.testName ?? o.testCode ?? "—"}
                trailing={
                  <>
                    <span
                      className={cn(
                        "rounded-md px-2 py-0.5 text-[11px] font-semibold capitalize",
                        STATUS_BADGE[o.status ?? ""] ?? TONE_BADGE.slate,
                      )}
                    >
                      {(o.status ?? "ordered").replace(/_/g, " ")}
                    </span>
                    {o.status === "ordered" ? (
                      <button
                        type="button"
                        onClick={() => collect.mutate(o.id)}
                        disabled={collect.isPending}
                        className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.1)] transition-colors hover:text-sky-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={13} /> {t("lab.markCollected")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setUploadOpen({ id: o.id })}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                    >
                      <Upload size={13} /> {t("lab.uploadResult")}
                    </button>
                  </>
                }
              />
            </li>
          ))}
        </ul>
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
              className={FIELD_TEXTAREA}
              value={result}
              onChange={(e) => setResult(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setUploadOpen(null)} className={SECONDARY_BTN}>
              {t("common.cancel")}
            </button>
            <button type="submit" className={PRIMARY_BTN}>{t("common.submit")}</button>
          </div>
        </Form>
      </Modal>
    </section>
  );
}

function CompletedPanel({ list, isLoading }: { list: LabOrder[]; isLoading: boolean }) {
  const t = useT();

  return (
    <section className={PANEL}>
      <PanelHeader
        icon={<CheckCircle2 size={16} />}
        tone="bg-emerald-50 text-emerald-600"
        title={t("lab.completed")}
        caption={`${list.length} results`}
      />
      {isLoading ? (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyBlock
          icon={<CheckCircle2 size={19} />}
          title={t("lab.emptyCompleted")}
          body="Completed lab orders will appear here."
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {list.map((o) => (
            <li key={o.id}>
              <RailRow
                tone="emerald"
                icon={<CheckCircle2 size={16} />}
                title={o.patientName ?? o.patientId ?? "—"}
                meta={o.testName ?? o.testCode ?? "—"}
                trailing={
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    {o.completedAt ?? t("lab.completed")}
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
