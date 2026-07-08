// Hospital operations live on the web portal — see HospitalWebRedirect.

import { useLocalSearchParams } from "expo-router";
import { HospitalWebRedirect } from "@/components/HospitalWebRedirect";

export default function HospitalPatientDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <HospitalWebRedirect
      path={`/hospital/reception/patients/${id ?? ""}`}
    />
  );
}