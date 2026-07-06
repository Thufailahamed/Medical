import { redirect } from "next/navigation";

export default async function PatientDefaultTab({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/portal/patients/${id}/overview`);
}
