/**
 * Portal 404 — replaces the previous 21-line stub.
 *
 * Two-branch UX: signed-in users get a "back to dashboard" link;
 * signed-out users (no token) get the sign-in link. We can't read
 * the auth store on the server, so the URL-aware behaviour here uses
 * the `next=` param + pathname heuristics instead.
 *
 * This page renders OUTSIDE the (portal) layout, so no sidebar —
 * intentionally a clean standalone screen.
 */

"use client";

import Link from "next/link";
import { FileQuestion, Home, LogIn } from "lucide-react";

import { useAuthStore } from "@/portal/stores/auth";
import { Button } from "@/portal/components/ui/Button";

export default function PortalNotFound() {
  // Client-only read: server render falls back to "signed out".
  const hasToken = useAuthStore((s) => !!s.token);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-surface-2 text-text-muted flex items-center justify-center mb-5">
          <FileQuestion size={28} />
        </div>
        <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-text-muted">
          404
        </p>
        <h1 className="text-2xl font-semibold text-text mt-2">
          Page not found
        </h1>
        <p className="text-sm text-text-soft mt-3 leading-relaxed">
          The page you tried to open doesn't exist, has moved, or you
          don't have permission to view it. If you followed a link from
          inside the portal, please report it to support.
        </p>
        <div className="mt-7 flex items-center justify-center gap-2">
          {hasToken ? (
            <Link href="/portal/dashboard">
              <Button variant="primary" leftIcon={<Home size={14} />}>
                Back to dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/portal/login">
              <Button variant="primary" leftIcon={<LogIn size={14} />}>
                Sign in
              </Button>
            </Link>
          )}
          <Link href="/">
            <Button variant="ghost">Marketing site</Button>
          </Link>
        </div>
        <p className="text-[10px] text-text-muted mt-8">
          Portal v0.1 · Healthcare platform
        </p>
      </div>
    </div>
  );
}