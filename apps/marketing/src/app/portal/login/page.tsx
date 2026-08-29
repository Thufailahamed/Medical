import { redirect } from "next/navigation";

/** Legacy doctor portal login → unified /login */
export default async function PortalLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ port: "doctor" });
  if (sp.next) qs.set("next", sp.next);
  redirect(`/login?${qs.toString()}`);
}
