import { redirect } from "next/navigation";

/** Legacy lab portal login → unified /login */
export default async function LabLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ port: "facility" });
  if (sp.next) qs.set("next", sp.next);
  redirect(`/login?${qs.toString()}`);
}
