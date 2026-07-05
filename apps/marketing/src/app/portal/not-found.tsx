import Link from "next/link";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <div className="h-14 w-14 rounded-full bg-surface-2 text-text-muted flex items-center justify-center mb-4">
        <FileQuestion size={26} />
      </div>
      <h1 className="text-lg font-semibold text-text">Page not found</h1>
      <p className="text-sm text-text-soft mt-1 max-w-sm">
        The page you tried to open doesn't exist or has moved.
      </p>
      <Link
        href="/portal/dashboard"
        className="mt-5 text-sm text-brand hover:underline underline-offset-2"
      >
        Back to dashboard
      </Link>
    </div>
  );
}