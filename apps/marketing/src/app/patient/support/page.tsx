"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  HelpCircle,
  MessageSquare,
  Mail,
  Phone,
  BookOpen,
  Send,
  Check,
} from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { api, ApiError } from "@/portal/lib/api";
import { patientPaths } from "@healthcare/shared/contracts";

const FAQS = [
  {
    q: "How do I see my lab results?",
    a: "Open Medical Records from the sidebar. Filter by type 'Lab' or use the search.",
  },
  {
    q: "Can I export my data?",
    a: "Yes. Go to Profile → Export my data. You can download a ZIP with all your records, prescriptions, and notes.",
  },
  {
    q: "How do I share with a new doctor?",
    a: "Open Share access, generate a one-time link, and choose which records to include.",
  },
  {
    q: "What if I change my phone number?",
    a: "Edit your profile to update it. We'll send a verification code to the new number.",
  },
];

export default function SupportPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(patientPaths.support.contact(), {
        method: "POST",
        json: { subject, message, category },
      });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "We couldn't send your message. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/dashboard"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to Dashboard
      </Link>

      <SectionHeader
        label="Help"
        title="Support"
        description="Find answers fast, or send the team a note. We respond within 24 hours."
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          <Card>
            {sent ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-success-soft text-success">
                  <Check size={28} aria-hidden />
                </div>
                <h2 className="text-lg font-bold text-text">Message sent</h2>
                <p className="text-sm text-text-soft">
                  We'll get back to you within 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSent(false);
                    setSubject("");
                    setMessage("");
                  }}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-3">
                <h2 className="text-sm font-bold text-text">Send a message</h2>

                <div>
                  <label htmlFor="category" className="t-label block">
                    Category
                  </label>
                  <select
                    id="category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                  >
                    <option value="general">General question</option>
                    <option value="bug">Report a bug</option>
                    <option value="account">Account &amp; login</option>
                    <option value="billing">Billing &amp; insurance</option>
                    <option value="data">My data &amp; privacy</option>
                    <option value="feature">Feature request</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="subject" className="t-label block">
                    Subject
                  </label>
                  <input
                    id="subject"
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                    placeholder="What's on your mind?"
                    className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label htmlFor="message" className="t-label block">
                    Message
                  </label>
                  <textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={6}
                    placeholder="Describe your question or issue. Don't include sensitive medical info."
                    className="mt-2 w-full rounded-inner border border-border bg-surface-2 px-4 py-3 text-sm text-text outline-none focus:border-brand"
                  />
                </div>

                {error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 self-start rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  <Send size={14} aria-hidden />
                  {busy ? "Sending…" : "Send message"}
                </button>
              </form>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card accent="brand">
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-bold text-text">Other ways to reach us</h3>
              <ul className="flex flex-col gap-2 text-sm text-text-soft">
                <li className="flex items-center gap-2">
                  <Mail size={13} aria-hidden className="text-brand" />
                  support@healthhub.lk
                </li>
                <li className="flex items-center gap-2">
                  <Phone size={13} aria-hidden className="text-brand" />
                  +94 11 234 5678
                </li>
                <li className="flex items-center gap-2">
                  <MessageSquare size={13} aria-hidden className="text-brand" />
                  In-app chat (Mon–Sat, 9am–6pm)
                </li>
              </ul>
            </div>
          </Card>

          <Card>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={16} aria-hidden className="text-brand" />
                <h3 className="text-sm font-bold text-text">FAQ</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {FAQS.map((f) => (
                  <li key={f.q} className="rounded-inner bg-surface-2 p-3">
                    <p className="text-sm font-semibold text-text">{f.q}</p>
                    <p className="mt-1 text-xs text-text-soft">{f.a}</p>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
