import { redirect } from "next/navigation";

/** Legacy patient login → unified /login */
export default async function PatientLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ port: "patient" });
  if (sp.next) qs.set("next", sp.next);
  redirect(`/login?${qs.toString()}`);
}
