"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  FlaskConical,
  Package,
  Pill,
  RefreshCw,
  X,
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
} from "@/patient/components/workspace";

type Tab = "queue" | "inventory";

type RxQueueItem = {
  id: string;
  patientName?: string | null;
  doctorName?: string | null;
  diagnosis?: string | null;
  items?: { medicineName?: string; dosage?: string; quantity?: number | string }[];
};

type InventoryRow = {
  medicineName?: string;
  dispensedQty?: number;
  orderedQty?: number;
  lastDispensedAt?: string | null;
};

export default function PharmacyPage() {
  const t = useT();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("queue");

  const queue = useQuery({
    queryKey: ["pharmacyQueue"],
    queryFn: () => api<{ prescriptions: RxQueueItem[] }>("/hospital-portal/pharmacy/queue"),
    refetchInterval: 30_000,
  });

  const inv = useQuery({
    queryKey: ["pharmacyInventory"],
    queryFn: () => api<{ rows: InventoryRow[] }>("/hospital-portal/pharmacy/inventory"),
  });

  const queueList = queue.data?.prescriptions ?? [];
  const invRows = inv.data?.rows ?? [];

  const hero = (
    <DoctorHero
      kickerIcon={<Pill size={13} aria-hidden />}
      kicker={t("nav.pharmacy")}
      kickerMeta={tab === "queue" ? t("nav.pharmacyQueue") : t("nav.pharmacyInventory")}
      title={
        <>
          {t("nav.pharmacy")}{" "}
          <span className="bg-gradient-to-r from-emerald-200 via-white to-teal-200 bg-clip-text text-transparent">
            · {tab === "queue" ? "queue" : "stock"}
          </span>
        </>
      }
      description={t("pharmacy.subtitle")}
      chips={
        <>
          <span className={HERO_CHIP}>
            <Pill size={12} className="text-rose-300" />
            {queueList.length} {t("pharmacy.signed").toLowerCase()}
          </span>
          <span className={HERO_CHIP}>
            <Package size={12} className="text-emerald-300" />
            {invRows.length} {t("pharmacy.medicine").toLowerCase()}s
          </span>
        </>
      }
      aside={
        <HeroPulse
          icon={<Pill size={18} />}
          label={t("nav.pharmacyQueue")}
          value={queue.isLoading ? "…" : queueList.length}
          sub={queueList.length > 0 ? "Awaiting dispense" : t("pharmacy.emptyQueue")}
        />
      }
      actions={
        <button
          type="button"
          onClick={() => {
            queue.refetch();
            inv.refetch();
          }}
          className={HERO_GHOST}
        >
          <RefreshCw
            size={13}
            className={queue.isFetching || inv.isFetching ? "animate-spin" : ""}
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
          icon={<Pill size={16} />}
          tone="bg-rose-50 text-rose-600"
          label={t("nav.pharmacyQueue")}
          value={queue.isLoading ? "…" : String(queueList.length)}
          sub={t("pharmacy.signed")}
          active={tab === "queue"}
          onClick={() => setTab("queue")}
          pulse={queueList.length > 0}
        />
        <StatTile
          icon={<Package size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label={t("nav.pharmacyInventory")}
          value={inv.isLoading ? "…" : String(invRows.length)}
          sub="Medicines on hand"
          active={tab === "inventory"}
          onClick={() => setTab("inventory")}
        />
        <StatTile
          icon={<CheckCircle2 size={16} />}
          tone="bg-sky-50 text-sky-600"
          label={t("pharmacy.dispense")}
          value="→"
          sub="Complete a prescription"
          onClick={() => setTab("queue")}
        />
        <StatTile
          icon={<FlaskConical size={16} />}
          tone="bg-violet-50 text-violet-600"
          label={t("nav.labOrders")}
          value="→"
          sub={t("lab.subtitle")}
          href="/hospital/lab"
        />
      </HeroOverlap>

      <div className="grid gap-5 xl:grid-cols-12">
        <div className="min-w-0 xl:col-span-9">
          <Segmented<Tab>
            ariaLabel="Pharmacy sections"
            value={tab}
            onChange={setTab}
            options={[
              { value: "queue", label: t("nav.pharmacyQueue"), count: queueList.length },
              { value: "inventory", label: t("nav.pharmacyInventory"), count: invRows.length },
            ]}
          />

          <div className="mt-5">
            {tab === "queue" ? (
              <QueuePanel list={queueList} isLoading={queue.isLoading} onChanged={() => qc.invalidateQueries({ queryKey: ["pharmacyQueue"] })} />
            ) : (
              <InventoryPanel rows={invRows} isLoading={inv.isLoading} />
            )}
          </div>
        </div>

        <aside className="flex flex-col gap-5 xl:col-span-3">
          <QuickToolsPanel
            id="pharmacy-quick-actions"
            title={t("dashboard.quickActions")}
            tools={[
              {
                icon: FlaskConical,
                label: t("nav.labOrders"),
                hint: "Queue",
                href: "/hospital/lab",
                tone: "from-violet-500 to-purple-600 shadow-violet-500/30",
              },
              {
                icon: Pill,
                label: t("nav.ipd"),
                hint: "Census",
                href: "/hospital/ipd",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
              {
                icon: Package,
                label: t("nav.dashboard"),
                hint: "Overview",
                href: "/hospital/dashboard",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
            ]}
          />

          <section className={PANEL}>
            <PanelHeader
              icon={<CheckCircle2 size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Dispense flow"
              caption="Signed → dispensed or rejected"
            />
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              Each prescription in the queue is signed by a doctor. Dispense to
              complete it, or reject with a reason so the prescriber can revise.
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
  list: RxQueueItem[];
  isLoading: boolean;
  onChanged: () => void;
}) {
  const t = useT();
  const [rejectOpen, setRejectOpen] = useState<{ id: string } | null>(null);
  const [reason, setReason] = useState("");

  const dispense = useMutation({
    mutationFn: (id: string) =>
      api(`/hospital-portal/pharmacy/prescriptions/${id}/dispense`, { method: "POST" }),
    onSuccess: () => {
      onChanged();
      toast.success("Dispensed");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api(`/hospital-portal/pharmacy/prescriptions/${id}/reject`, {
        method: "POST",
        json: { reason },
      }),
    onSuccess: () => {
      onChanged();
      setRejectOpen(null);
      setReason("");
      toast.success("Rejected");
    },
    onError: (e: Error) => toast.error(e.message ?? "Failed"),
  });

  return (
    <section className={PANEL}>
      <PanelHeader
        icon={<Pill size={16} />}
        tone="bg-rose-50 text-rose-600"
        title={t("nav.pharmacyQueue")}
        caption={`${list.length} ${t("pharmacy.signed").toLowerCase()}`}
      />
      {isLoading ? (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyBlock
          icon={<Pill size={19} />}
          title={t("pharmacy.emptyQueue")}
          body="Signed prescriptions will appear here for dispensing."
        />
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {list.map((p) => (
            <li key={p.id}>
              <RailRow
                tone="rose"
                icon={<Pill size={16} />}
                title={p.patientName ?? "—"}
                meta={`${t("pharmacy.prescribedBy")}: ${p.doctorName ?? "—"}${p.diagnosis ? ` · ${p.diagnosis}` : ""}`}
                trailing={
                  <>
                    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      {t("pharmacy.signed")}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRejectOpen({ id: p.id })}
                      className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"
                    >
                      <X size={13} /> {t("pharmacy.reject")}
                    </button>
                    <button
                      type="button"
                      onClick={() => dispense.mutate(p.id)}
                      disabled={dispense.isPending}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#07233a] px-3 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Check size={13} /> {t("pharmacy.dispense")}
                    </button>
                  </>
                }
              >
                {p.items?.length ? (
                  <span className="mt-2 flex flex-wrap gap-1.5">
                    {p.items.map((it, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600"
                      >
                        {it.medicineName} · {it.dosage} · qty {it.quantity}
                      </span>
                    ))}
                  </span>
                ) : null}
              </RailRow>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!rejectOpen}
        onClose={() => setRejectOpen(null)}
        title={t("pharmacy.reject")}
      >
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            if (rejectOpen) reject.mutate({ id: rejectOpen.id, reason });
          }}
        >
          <FormField label={t("pharmacy.reason")} required>
            <textarea
              required
              rows={3}
              className={FIELD_TEXTAREA}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRejectOpen(null)} className={SECONDARY_BTN}>
              {t("common.cancel")}
            </button>
            <button type="submit" className={PRIMARY_BTN}>{t("common.submit")}</button>
          </div>
        </Form>
      </Modal>
    </section>
  );
}

function InventoryPanel({ rows, isLoading }: { rows: InventoryRow[]; isLoading: boolean }) {
  const t = useT();

  return (
    <section className={PANEL}>
      <PanelHeader
        icon={<Package size={16} />}
        tone="bg-emerald-50 text-emerald-600"
        title={t("nav.pharmacyInventory")}
        caption={`${rows.length} ${t("pharmacy.medicine").toLowerCase()}s`}
      />
      {isLoading ? (
        <div className="mt-4 space-y-2.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyBlock
          icon={<Package size={19} />}
          title={t("pharmacy.emptyInventory")}
          body="Dispensed stock will accumulate here once prescriptions are fulfilled."
        />
      ) : (
        <div className="-mx-5 mt-4 overflow-x-auto px-5 sm:-mx-6 sm:px-6">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-2.5 pr-4">{t("pharmacy.medicine")}</th>
                <th className="py-2.5 pr-4">{t("pharmacy.dispensedQty")}</th>
                <th className="py-2.5 pr-4">{t("pharmacy.orderedQty")}</th>
                <th className="py-2.5 pr-4">{t("pharmacy.lastDispensed")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-3 pr-4 font-semibold text-slate-900">{r.medicineName}</td>
                  <td className="py-3 pr-4 tabular-nums text-slate-700">{r.dispensedQty}</td>
                  <td className="py-3 pr-4 tabular-nums text-slate-700">{r.orderedQty}</td>
                  <td className="py-3 pr-4 text-slate-400">{r.lastDispensedAt ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
