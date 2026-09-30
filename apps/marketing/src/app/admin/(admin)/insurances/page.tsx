"use client";

import { ShieldCheck } from "lucide-react";
import { adminQk } from "@/portal/lib/admin-api";
import { UserTenantDirectory } from "@/portal/components/admin/UserTenantDirectory";

export default function AdminInsurancesPage() {
  return (
    <UserTenantDirectory
      queryKey={adminQk.users({ role: "insurance" })}
      endpoint="/admin/operator/users?role=insurance"
      kicker="Payers"
      title="Insurance"
      titleAccent="providers"
      description="Insurers that verify policies and settle claims on HealthHub."
      noun="insurance provider"
      plural="insurance providers"
      icon={(s) => <ShieldCheck size={s} aria-hidden />}
      tileTone="from-amber-500 to-orange-600 shadow-amber-500/30"
    />
  );
}
