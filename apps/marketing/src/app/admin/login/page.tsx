import { redirect } from "next/navigation";

/** Legacy admin login → unified /login */
export default async function AdminLoginRedirect({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams({ port: "operator" });
  if (sp.next) qs.set("next", sp.next);
  redirect(`/login?${qs.toString()}`);
}
