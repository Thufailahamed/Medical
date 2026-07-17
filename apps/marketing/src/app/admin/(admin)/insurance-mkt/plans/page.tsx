"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Modal } from "@/portal/components/ui/Modal";
import { Field, Input } from "@/portal/components/ui/Form";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Plan = {
  id: string;
  providerId: string;
  providerName: string;
  name: string;
  planType: string;
  coverageSummaryLkr: number;
  monthlyPremiumLkr: number;
  annualPremiumLkr: number;
  annualDiscountPct: number;
  isPublished: boolean;
  isFeatured: boolean;
};

const PLAN_TYPES = [
  "individual",
  "family_floater",
  "senior",
  "critical_illness",
  "cancer",
  "dental",
  "maternity",
];

export default function AdminInsurancePlansPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [providerFilter, setProviderFilter] = useState("");

  const [form, setForm] = useState({
    providerId: "",
    name: "",
    slug: "",
    planType: "individual",
    coverageSummaryLkr: "",
    monthlyPremiumLkr: "",
    annualPremiumLkr: "",
    copayPct: "20",
    networkHospitalCount: "100",
  });

  const { data, isLoading } = useQuery({
    queryKey: adminQk.insurancePlans({ providerFilter }),
    queryFn: () =>
      adminApi<{ plans: Plan[]; total: number }>(
        `/admin/insurance-plans${providerFilter ? `?providerId=${providerFilter}` : ""}`,
      ),
  });

  const { data: providersData } = useQuery({
    queryKey: adminQk.insuranceProviders({}),
    queryFn: () =>
      adminApi<{ providers: Array<{ id: string; name: string }> }>(
        "/admin/insurance-providers",
      ),
  });

  const createMut = useMutation({
    mutationFn: () =>
      adminApi("/admin/insurance-plans", {
        method: "POST",
        json: {
          providerId: form.providerId,
          name: form.name,
          slug: form.slug,
          planType: form.planType,
          coverageSummaryLkr: Number(form.coverageSummaryLkr),
          monthlyPremiumLkr: Number(form.monthlyPremiumLkr),
          annualPremiumLkr: Number(form.annualPremiumLkr),
          copayPct: Number(form.copayPct),
          networkHospitalCount: Number(form.networkHospitalCount),
          deductibleLkr: 0,
          waitingPeriodDays: 30,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "insurance-plans"] });
      setCreateOpen(false);
      setForm({
        providerId: "",
        name: "",
        slug: "",
        planType: "individual",
        coverageSummaryLkr: "",
        monthlyPremiumLkr: "",
        annualPremiumLkr: "",
        copayPct: "20",
        networkHospitalCount: "100",
      });
      toast.success("Plan created");
    },
    onError: (e: unknown) =>
      toast.error("Failed", e instanceof Error ? e.message : "Unknown error"),
  });

  const plans = data?.plans ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Insurance plans"
        subtitle={`${data?.total ?? 0} listed`}
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            leftIcon={<Plus size={14} />}
          >
            New plan
          </Button>
        }
      />

      <div className="flex gap-2">
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="px-3 py-2 border border-border rounded-xl bg-surface text-sm"
        >
          <option value="">All providers</option>
          {providersData?.providers?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
          No plans yet.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Provider</TH>
              <TH>Type</TH>
              <TH className="text-right">Monthly</TH>
              <TH className="text-right">Annual</TH>
              <TH className="text-right">Coverage</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {plans.map((p) => (
              <TR key={p.id} className="hover:bg-surface-2">
                <TD className="font-semibold">
                  <Link
                    href={`/admin/insurance-mkt/plans/${p.id}`}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                </TD>
                <TD className="text-xs">{p.providerName}</TD>
                <TD className="text-xs capitalize">
                  {p.planType.replace(/_/g, " ")}
                </TD>
                <TD className="text-xs text-right">
                  {p.monthlyPremiumLkr.toLocaleString()}
                </TD>
                <TD className="text-xs text-right">
                  {p.annualPremiumLkr.toLocaleString()}
                </TD>
                <TD className="text-xs text-right">
                  {p.coverageSummaryLkr.toLocaleString()}
                </TD>
                <TD>
                  <Pill tone={p.isPublished ? "success" : "warn"}>
                    {p.isPublished ? "Published" : "Draft"}
                  </Pill>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create plan"
      >
        <div className="flex flex-col gap-3">
          <Field label="Provider">
            <select
              value={form.providerId}
              onChange={(e) => setForm({ ...form, providerId: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl bg-surface text-sm"
            >
              <option value="">Select…</option>
              {providersData?.providers?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Slug">
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="kebab-case"
            />
          </Field>
          <Field label="Plan type">
            <select
              value={form.planType}
              onChange={(e) => setForm({ ...form, planType: e.target.value })}
              className="w-full px-3 py-2 border border-border rounded-xl bg-surface text-sm"
            >
              {PLAN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Monthly premium (LKR)">
            <Input
              type="number"
              value={form.monthlyPremiumLkr}
              onChange={(e) =>
                setForm({ ...form, monthlyPremiumLkr: e.target.value })
              }
            />
          </Field>
          <Field label="Annual premium (LKR)">
            <Input
              type="number"
              value={form.annualPremiumLkr}
              onChange={(e) =>
                setForm({ ...form, annualPremiumLkr: e.target.value })
              }
            />
          </Field>
          <Field label="Coverage (LKR)">
            <Input
              type="number"
              value={form.coverageSummaryLkr}
              onChange={(e) =>
                setForm({ ...form, coverageSummaryLkr: e.target.value })
              }
            />
          </Field>
          <Field label="Copay %">
            <Input
              type="number"
              value={form.copayPct}
              onChange={(e) =>
                setForm({ ...form, copayPct: e.target.value })
              }
            />
          </Field>
          <Field label="Network hospital count">
            <Input
              type="number"
              value={form.networkHospitalCount}
              onChange={(e) =>
                setForm({ ...form, networkHospitalCount: e.target.value })
              }
            />
          </Field>
          <Button
            loading={createMut.isPending}
            onClick={() => createMut.mutate()}
            disabled={
              !form.providerId ||
              !form.name ||
              !form.slug ||
              !form.monthlyPremiumLkr
            }
          >
            Create plan
          </Button>
        </div>
      </Modal>
    </div>
  );
}