"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Mail, Loader2, Check, AlertCircle } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";

export default function EmailImportPage() {
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState<"gmail" | "outlook" | "other">("gmail");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(patientPaths.emailImport.trigger(), {
        method: "POST",
        json: { email, provider },
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't start the import. Please try again later."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/profile"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to profile
      </Link>

      <SectionHeader
        label="Settings"
        title="Import from email"
        description="Connect a mailbox to find lab reports, prescriptions, and bills that were emailed to you."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Card>
            {success ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
                  <Check size={28} aria-hidden />
                </div>
                <h2 className="text-lg font-bold text-text">
                  Import started
                </h2>
                <p className="text-sm text-text-soft">
                  We'll scan recent emails from hospitals and labs. New
                  records will appear in your file as they're found.
                </p>
                <Link
                  href="/patient/records"
                  className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white"
                >
                  Go to records
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-text">Connect a mailbox</h2>
                <p className="text-xs text-text-soft">
                  You'll be redirected to authorize read-only access. We never
                  see your password.
                </p>

                <div>
                  <label htmlFor="provider" className="t-label block">
                    Email provider
                  </label>
                  <select
                    id="provider"
                    value={provider}
                    onChange={(e) =>
                      setProvider(e.target.value as "gmail" | "outlook" | "other")
                    }
                    className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                  >
                    <option value="gmail">Gmail</option>
                    <option value="outlook">Outlook / Microsoft 365</option>
                    <option value="other">Other IMAP</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="email" className="t-label block">
                    Email address
                  </label>
                  <div className="relative mt-2">
                    <Mail
                      size={14}
                      aria-hidden
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="you@gmail.com"
                      className="h-11 w-full rounded-pill border border-border bg-surface-2 pl-9 pr-4 text-sm text-text outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    "Connect mailbox"
                  )}
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card accent="amber">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={16} aria-hidden className="text-amber-600" />
                <h3 className="text-sm font-bold text-text">
                  How it works
                </h3>
              </div>
              <ol className="ml-4 list-decimal text-xs text-text-soft">
                <li>Authorize read-only access to your mailbox.</li>
                <li>
                  We scan the last 90 days of mail for attachments from
                  recognized hospitals and labs.
                </li>
                <li>Matching PDFs are added to your medical record.</li>
                <li>You can disconnect any time from this page.</li>
              </ol>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
