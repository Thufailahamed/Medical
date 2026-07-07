"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AdminForbiddenPage() {
  return (
    <div className="min-h-screen grid place-items-center bg-bg admin-bg">
      <div className="bg-surface border border-border rounded-2xl p-10 text-center max-w-md shadow-sm">
        <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-danger-soft text-danger flex items-center justify-center">
          <ShieldAlert size={28} strokeWidth={2.25} />
        </div>
        <h1 className="text-2xl font-bold mb-2">Admin only</h1>
        <p className="text-text-soft text-sm leading-relaxed mb-6">
          This portal is restricted to platform administrators. If you believe
          you should have access, contact another super_admin.
        </p>
        <div className="flex gap-2 justify-center">
          <Link
            href="/admin/login"
            className="px-4 h-10 rounded-lg bg-amber-600 text-white text-sm font-semibold inline-flex items-center"
          >
            Admin sign in
          </Link>
          <Link
            href="/"
            className="px-4 h-10 rounded-lg border border-border text-text text-sm font-semibold inline-flex items-center"
          >
            Marketing site
          </Link>
        </div>
      </div>
    </div>
  );
}