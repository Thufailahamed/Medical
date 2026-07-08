// Hospital operations live on the web portal — see HospitalWebRedirect.

import { useLocalSearchParams } from "expo-router";
import { HospitalWebRedirect } from "@/components/HospitalWebRedirect";

export default function HospitalWardDetailRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <HospitalWebRedirect path={`/hospital/wards/${id ?? ""}`} />
  );
}