// Hospital operations live on the web portal (`/hospital/*`). Mobile deep
// links from notifications resolve here so we keep the route registered,
// but the screen is a CTA that hands off to the browser. See
// `src/components/HospitalWebRedirect.tsx`.

import { HospitalWebRedirect } from "@/components/HospitalWebRedirect";

export default function HospitalDashboardRedirect() {
  return <HospitalWebRedirect path="/hospital/dashboard" />;
}