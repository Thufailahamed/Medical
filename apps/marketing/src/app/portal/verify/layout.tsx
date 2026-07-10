/**
 * Standalone verify layout — no sidebar/topbar.
 * Public verification should not render inside the doctor portal shell.
 */
export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-bg">{children}</div>;
}
