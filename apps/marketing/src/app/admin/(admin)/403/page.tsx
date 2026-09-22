"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AdminForbiddenPage() {
  return (
    <div className="min-h-screen grid place-items-center admin-bg">
      <div className="portal-card bg-surface border border-border rounded-3xl p-10 text-center max-w-md shadow-md">
        <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-danger-soft text-danger ring-1 ring-inset ring-danger/15 shadow-2xs">
          <ShieldAlert size={30} strokeWidth={2.25} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight mb-2">Admin only</h1>
        <p className="text-text-soft text-sm leading-relaxed mb-7">
          This portal is restricted to platform administrators. If you believe
          you should have access, contact another super_admin.
        </p>
        <div className="flex gap-2.5 justify-center">
          <Link
            href="/login?port=operator"
            className="portal-btn portal-btn-primary portal-btn-md no-underline hover:no-underline"
          >
            Admin sign in
          </Link>
          <Link
            href="/"
            className="portal-btn portal-btn-secondary portal-btn-md no-underline hover:no-underline"
          >
            Marketing site
          </Link>
        </div>
      </div>
    </div>
  );
}