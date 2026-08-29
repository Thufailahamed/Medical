import { redirect } from "next/navigation";

export default async function ImagingStudyPage({
  params,
}: {
  params: Promise<{ studyUid: string }>;
}) {
  const { studyUid } = await params;
  redirect(`/portal/me/imaging/${studyUid}`);
}
