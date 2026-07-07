"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { SlmcDocsPanel } from "@/portal/components/admin/SlmcDocsPanel";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

type Row = {
  doctorId: string;
  userId: string;
  name: string;
  email: string | null;
  status: string;
  specialization: string | null;
  slmcRegistrationNo: string | null;
  slmcVerifiedAt: string | null;
  hospitalId: string | null;
  rating: number | null;
  experience: number | null;
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "verified", label: "SLMC verified" },
  { key: "unverified", label: "Not verified" },
] as const;

export default function AdminDoctorsPage() {
  const qc = useQueryClient();
  const [slmc, setSlmc] = useState<"all" | "verified" | "unverified">("all");
  const [openDoctor, setOpenDoctor] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: adminQk.doctors({ slmc }),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/doctors?slmc=${slmc}&limit=200`),
  });

  const verify = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "verify-slmc" | "revoke-slmc" }) =>
      adminApi(`/admin/doctors/${id}/${action}`, { method: "POST", json: {} }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "verify-slmc" ? "SLMC verified" : "SLMC revoked");
      qc.invalidateQueries({ queryKey: ["admin", "doctors"] });
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        title="Doctors"
        subtitle={`${data?.total ?? 0} registered`}
      />

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="admin-filter-pill"
            data-active={slmc === f.key}
            onClick={() => setSlmc(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <p className="text-text-soft text-sm">Loading…</p>
      ) : data.items.length === 0 ? (
        <div className="bg-surface border border-border rounded-2xl p-10 text-center">
          <p className="text-text-soft">No doctors match.</p>
        </div>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Specialty</TH>
              <TH>SLMC</TH>
              <TH>Status</TH>
              <TH>Hospital</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {data.items.map((d) => (
              <TR
                key={d.doctorId}
                onClick={() => setOpenDoctor(d)}
                className="cursor-pointer hover:bg-surface-2/50"
              >
                <TD>
                  <p className="font-semibold">{d.name}</p>
                  <p className="text-[11px] text-text-muted">{d.email}</p>
                </TD>
                <TD className="text-sm">{d.specialization || "—"}</TD>
                <TD>
                  <p className="text-sm">{d.slmcRegistrationNo || "—"}</p>
                  {d.slmcVerifiedAt ? (
                    <Pill tone="success">verified</Pill>
                  ) : (
                    <Pill tone="warn">not verified</Pill>
                  )}
                </TD>
                <TD><Pill tone={d.status === "active" ? "success" : "warn"}>{d.status}</Pill></TD>
                <TD className="text-xs text-text-muted">{d.hospitalId ? "linked" : "—"}</TD>
                <TD className="text-right" onClick={(e) => e.stopPropagation()}>
                  {d.slmcVerifiedAt ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => verify.mutate({ id: d.doctorId, action: "revoke-slmc" })}
                      disabled={verify.isPending}
                    >
                      <ShieldOff size={14} className="mr-1" />Revoke SLMC
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => verify.mutate({ id: d.doctorId, action: "verify-slmc" })}
                      disabled={verify.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <ShieldCheck size={14} className="mr-1" />Verify SLMC
                    </Button>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Drawer
        open={openDoctor != null}
        onClose={() => setOpenDoctor(null)}
        title={openDoctor?.name ?? ""}
        subtitle={
          openDoctor ? (
            <span>
              {openDoctor.specialization ?? "—"} · SLMC {openDoctor.slmcRegistrationNo ?? "—"}
            </span>
          ) : null
        }
        size="lg"
      >
        {openDoctor ? <SlmcDocsPanel doctorId={openDoctor.doctorId} /> : null}
      </Drawer>
    </div>
  );
}