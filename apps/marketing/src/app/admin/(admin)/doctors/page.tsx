"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ShieldOff, Stethoscope } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Pill } from "@/portal/components/ui/Pill";
import { Table, THead, TBody, TR, TH, TD } from "@/portal/components/ui/Table";
import { Button } from "@/portal/components/ui/Button";
import { Drawer } from "@/portal/components/ui/Modal";
import { SlmcDocsPanel } from "@/portal/components/admin/SlmcDocsPanel";
import { adminApi, adminApiWithStepUp, adminQk } from "@/portal/lib/admin-api";
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

type Filter = (typeof FILTERS)[number]["key"];

export default function AdminDoctorsPage() {
  const qc = useQueryClient();
  const params = useSearchParams();
  const initialSlmc = (params.get("slmc") as Filter) ?? "all";
  const [slmc, setSlmc] = useState<Filter>(initialSlmc);
  const [openDoctor, setOpenDoctor] = useState<Row | null>(null);

  useEffect(() => {
    const next = (params.get("slmc") as Filter) ?? "all";
    setSlmc(next);
  }, [params]);

  const { data, isLoading } = useQuery({
    queryKey: adminQk.doctors({ slmc }),
    queryFn: () => adminApi<{ items: Row[]; total: number }>(`/admin/doctors?slmc=${slmc}&limit=200`),
  });

  const verify = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "verify-slmc" | "revoke-slmc" }) =>
      adminApiWithStepUp(`/admin/doctors/${id}/${action}`, { method: "POST", json: {} }),
    onSuccess: (_, vars) => {
      toast.success(vars.action === "verify-slmc" ? "SLMC verified" : "SLMC revoked");
      qc.invalidateQueries({ queryKey: ["admin", "doctors"] });
    },
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-7xl">
      <PageHeader
        icon={<Stethoscope size={20} className="text-blue-600" />}
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
        <div className="flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-surface p-5 shadow-sm" role="status" aria-label="Loading">
          <div className="h-4 w-1/4 admin-shimmer rounded-md" />
          <div className="h-4 w-full admin-shimmer rounded-md" />
          <div className="h-4 w-5/6 admin-shimmer rounded-md" />
          <div className="h-4 w-2/3 admin-shimmer rounded-md" />
        </div>
      ) : data.items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-surface p-10 text-center text-sm font-medium text-text-soft shadow-2xs">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-surface-2 text-text-muted ring-1 ring-inset ring-border">
            <Stethoscope size={18} aria-hidden />
          </div>
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