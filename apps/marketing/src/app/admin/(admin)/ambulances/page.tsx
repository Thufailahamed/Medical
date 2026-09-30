"use client";

import { Ambulance } from "lucide-react";
import { adminQk } from "@/portal/lib/admin-api";
import { UserTenantDirectory } from "@/portal/components/admin/UserTenantDirectory";

export default function AdminAmbulancesPage() {
  return (
    <UserTenantDirectory
      queryKey={adminQk.users({ role: "ambulance" })}
      endpoint="/admin/operator/users?role=ambulance"
      kicker="Emergency services"
      title="Ambulance"
      titleAccent="operators"
      description="EMS providers dispatched through the platform's emergency flow."
      noun="ambulance operator"
      plural="ambulance operators"
      icon={(s) => <Ambulance size={s} aria-hidden />}
      tileTone="from-red-500 to-rose-600 shadow-red-500/30"
    />
  );
}
