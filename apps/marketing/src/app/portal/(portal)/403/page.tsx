import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="h-14 w-14 rounded-full bg-danger-soft text-danger flex items-center justify-center mb-4">
        <ShieldAlert size={26} />
      </div>
      <h1 className="text-lg font-semibold text-text">This portal is for clinicians</h1>
      <p className="text-sm text-text-soft mt-1 max-w-sm">
        Your account is signed in, but it doesn't have doctor privileges. If you think this is
        a mistake, contact your clinic admin.
      </p>
      <Link
        href="/portal/login"
        className="mt-5 text-sm text-brand hover:underline underline-offset-2"
      >
        Back to sign-in
      </Link>
    </div>
  );
}