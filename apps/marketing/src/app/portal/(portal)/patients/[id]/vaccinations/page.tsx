"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Syringe, Plus } from "lucide-react";

import { api } from "@/portal/lib/api";
import { Pill } from "@/portal/components/ui/Pill";
import { Button } from "@/portal/components/ui/Button";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";
import { formatDate, relativeTime } from "@/portal/lib/format";
import {
  ChartTabHeader,
  ChartList,
  ChartRow,
  ChartEmpty,
  FilterPills,
} from "@/portal/components/chart";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input, Textarea } from "@/portal/components/ui/Form";

type Status = "all" | "given" | "due";

interface Vaccination {
  id: string;
  vaccine: string;
  shortName?: string | null;
  doseNumber: number;
  administeredAt?: string | null;
  nextDueAt?: string | null;
}

interface PatientOverviewShape {
  vaccinations?: Vaccination[];
}

const STATUS_VALUES: Status[] = ["all", "given", "due"];

interface CreateVaccinationBody {
  vaccineName: string;
  doseNumber: number;
  administeredAt: string;
  provider?: string;
  notes?: string;
}

export default function VaccinationsTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const t = useT();
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateVaccinationBody>({
    vaccineName: "",
    doseNumber: 1,
    administeredAt: new Date().toISOString().slice(0, 10),
    provider: "",
    notes: "",
  });

  // Vaccinations ship on the overview payload — same data the
  // sidebar widget uses. No dedicated endpoint needed for the read
  // path; the write path uses a dedicated mutation (below) so the
  // patient overview query stays cache-stable.
  const { data, isLoading } = useQuery({
    queryKey: ["doctor-portal", "patient", id, "overview"],
    queryFn: () =>
      api<PatientOverviewShape>(`/doctor-portal/patients/${id}/overview`),
  });

  const create = useMutation({
    mutationFn: (body: CreateVaccinationBody) =>
      api<{ vaccination: Vaccination }>(
        `/doctor-portal/vaccinations`,
        { method: "POST", json: { ...body, patientId: id } },
      ),
    onSuccess: () => {
      toast.success(t("tab.vaccinations.createSuccess"));
      qc.invalidateQueries({
        queryKey: ["doctor-portal", "patient", id, "overview"],
      });
      setCreateOpen(false);
      setForm({
        vaccineName: "",
        doseNumber: 1,
        administeredAt: new Date().toISOString().slice(0, 10),
        provider: "",
        notes: "",
      });
    },
    onError: (e: any) => toast.error(t("tab.vaccinations.createFail"), e?.message),
  });

  const all = data?.vaccinations ?? [];
  const given = all.filter((v) => !!v.administeredAt);
  const due = all.filter((v) => !v.administeredAt || !!v.nextDueAt);

  const rows = status === "given" ? given : status === "due" ? due : all;

  const filterOptions: { value: Status; label: string; count?: number }[] =
    STATUS_VALUES.map((s) => ({
      value: s,
      label:
        s === "all"
          ? t("tab.vaccinations.filterAll")
          : t(`tab.vaccinations.filter${s[0].toUpperCase()}${s.slice(1)}`),
      count: s === "all" ? all.length : s === "given" ? given.length : due.length,
    }));

  return (
    <div className="flex flex-col gap-4">
      <ChartTabHeader
        icon={<Syringe size={18} />}
        title={t("tab.vaccinations.title")}
        subtitle={t("tab.vaccinations.subtitle", { count: all.length })}
        badge={{ count: all.length, tone: "info" }}
        actions={
          <Button
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => setCreateOpen(true)}
          >
            {t("tab.vaccinations.new")}
          </Button>
        }
      />

      <ChartList
        items={rows}
        isLoading={isLoading}
        isEmpty={!isLoading && rows.length === 0}
        toolbar={
          <FilterPills<Status>
            value={status}
            onChange={setStatus}
            options={filterOptions}
          />
        }
        emptyState={
          <ChartEmpty
            icon={<Syringe size={20} />}
            title={t("tab.vaccinations.empty")}
            description={t("tab.vaccinations.emptyBody")}
          />
        }
        renderRow={(v) => (
          <ChartRow
            icon={<Syringe size={16} />}
            iconTone="info"
            title={v.vaccine}
            subtitle={
              <span className="text-[11px] text-text-muted">
                {v.shortName ? `${v.shortName} · ` : ""}
                {t("tab.vaccinations.dose", { n: v.doseNumber })}
              </span>
            }
            pills={[
              v.administeredAt ? (
                <Pill key="given" tone="success">
                  {t("tab.vaccinations.administered", {
                    date: formatDate(v.administeredAt),
                  })}
                </Pill>
              ) : null,
              v.nextDueAt ? (
                <Pill key="due" tone="info">
                  {t("tab.vaccinations.nextDue", {
                    date: relativeTime(v.nextDueAt),
                  })}
                </Pill>
              ) : null,
            ].filter(Boolean)}
          />
        )}
      />

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t("tab.vaccinations.createTitle")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="primary"
              loading={create.isPending}
              disabled={!form.vaccineName.trim()}
              onClick={() => create.mutate(form)}
            >
              {t("common.save")}
            </Button>
          </div>
        }
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.vaccineName.trim()) return;
            create.mutate(form);
          }}
        >
          <Field label={t("tab.vaccinations.form.name")} htmlFor="vx-name" required>
            <Input
              id="vx-name"
              value={form.vaccineName}
              onChange={(e) => setForm({ ...form, vaccineName: e.target.value })}
              placeholder="BCG"
              maxLength={200}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("tab.vaccinations.form.dose")} htmlFor="vx-dose">
              <Input
                id="vx-dose"
                type="number"
                min={1}
                max={20}
                value={String(form.doseNumber)}
                onChange={(e) =>
                  setForm({
                    ...form,
                    doseNumber: Math.max(1, parseInt(e.target.value, 10) || 1),
                  })
                }
              />
            </Field>
            <Field
              label={t("tab.vaccinations.form.date")}
              htmlFor="vx-date"
              required
            >
              <Input
                id="vx-date"
                type="date"
                value={form.administeredAt}
                onChange={(e) => setForm({ ...form, administeredAt: e.target.value })}
              />
            </Field>
          </div>
          <Field label={t("tab.vaccinations.form.provider")} htmlFor="vx-provider">
            <Input
              id="vx-provider"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              placeholder="Dr. …"
            />
          </Field>
          <Field label={t("tab.vaccinations.form.notes")} htmlFor="vx-notes">
            <Textarea
              id="vx-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
