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
import { Field, Input, Textarea } from "@/portal/components/ui/Form";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Provider = {
  id: string;
  name: string;
  slug: string;
  tagline?: string | null;
  claimSettlementRatioPct?: number | null;
  ratingAvg: number;
  ratingCount: number;
  isPublished: boolean;
  planCount?: number;
};

export default function AdminInsuranceProvidersPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    tagline: "",
    description: "",
    regulatorLicense: "",
    websiteUrl: "",
    supportPhone: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: adminQk.insuranceProviders({}),
    queryFn: () =>
      adminApi<{ providers: Provider[]; total: number }>(
        "/admin/insurance-providers",
      ),
  });

  const createMut = useMutation({
    mutationFn: () =>
      adminApi("/admin/insurance-providers", {
        method: "POST",
        json: {
          ...form,
          claimSettlementRatioPct: null,
          cashlessHospitalCount: null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin", "insurance-providers"],
      });
      setCreateOpen(false);
      setForm({
        name: "",
        slug: "",
        tagline: "",
        description: "",
        regulatorLicense: "",
        websiteUrl: "",
        supportPhone: "",
      });
      toast.success("Provider created");
    },
    onError: (e: unknown) =>
      toast.error("Failed", e instanceof Error ? e.message : "Unknown error"),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      adminApi(`/admin/insurance-providers/${id}`, {
        method: "PUT",
        json: { isPublished },
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: ["admin", "insurance-providers"],
      });
    },
  });

  const providers = data?.providers ?? [];

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Insurance providers"
        subtitle={`${data?.total ?? 0} registered`}
        actions={
          <Button
            onClick={() => setCreateOpen(true)}
            leftIcon={<Plus size={14} />}
          >
            New provider
          </Button>
        }
      />
      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : providers.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center text-text-soft">
          No providers yet.
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Slug</TH>
              <TH>Tagline</TH>
              <TH>Rating</TH>
              <TH>Plans</TH>
              <TH>Status</TH>
              <TH className="w-12">.</TH>
            </TR>
          </THead>
          <TBody>
            {providers.map((p) => (
              <TR key={p.id} className="hover:bg-surface-2">
                <TD className="font-semibold">
                  <Link
                    href={`/admin/insurance-mkt/providers/${p.id}`}
                    className="hover:underline"
                  >
                    {p.name}
                  </Link>
                </TD>
                <TD className="text-xs text-text-muted">{p.slug}</TD>
                <TD className="text-xs">{p.tagline || "—"}</TD>
                <TD className="text-xs">
                  {p.ratingAvg.toFixed(1)} ({p.ratingCount})
                </TD>
                <TD className="text-xs">{p.planCount ?? 0}</TD>
                <TD>
                  <Pill tone={p.isPublished ? "success" : "warn"}>
                    {p.isPublished ? "Published" : "Draft"}
                  </Pill>
                </TD>
                <TD>
                  <button
                    onClick={() =>
                      toggleMut.mutate({
                        id: p.id,
                        isPublished: !p.isPublished,
                      })
                    }
                    className="text-xs text-primary hover:underline"
                  >
                    {p.isPublished ? "Unpublish" : "Publish"}
                  </button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create provider"
      >
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label="Slug (kebab-case)">
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              placeholder="e.g. sri-lanka-insurance"
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={form.tagline}
              onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            />
          </Field>
          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </Field>
          <Field label="Regulator license">
            <Input
              value={form.regulatorLicense}
              onChange={(e) =>
                setForm({ ...form, regulatorLicense: e.target.value })
              }
            />
          </Field>
          <Field label="Website">
            <Input
              value={form.websiteUrl}
              onChange={(e) =>
                setForm({ ...form, websiteUrl: e.target.value })
              }
            />
          </Field>
          <Field label="Support phone">
            <Input
              value={form.supportPhone}
              onChange={(e) =>
                setForm({ ...form, supportPhone: e.target.value })
              }
            />
          </Field>
          <Button
            loading={createMut.isPending}
            onClick={() => createMut.mutate()}
            disabled={!form.name || !form.slug}
          >
            Create provider
          </Button>
        </div>
      </Modal>
    </div>
  );
}