"use client";

import { Store } from "lucide-react";
import { adminQk } from "@/portal/lib/admin-api";
import { UserTenantDirectory } from "@/portal/components/admin/UserTenantDirectory";

export default function AdminPharmaciesPage() {
  return (
    <UserTenantDirectory
      queryKey={adminQk.users({ role: "pharmacy" })}
      endpoint="/admin/users?role=pharmacy&limit=200"
      kicker="Tenant network"
      title="Pharmacies"
      titleAccent="& dispensaries"
      description="Partner pharmacies that fulfil e-prescriptions issued on HealthHub."
      noun="pharmacy"
      icon={(s) => <Store size={s} aria-hidden />}
      tileTone="from-lime-500 to-emerald-600 shadow-emerald-500/30"
    />
  );
}
