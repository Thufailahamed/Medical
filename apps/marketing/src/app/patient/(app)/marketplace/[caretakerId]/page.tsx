"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Star, MapPin, BadgeCheck, Send, Loader2, Check } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { Pill as StatusPill } from "@/patient/components/primitives/Pill";
import { QueryBoundary } from "@/patient/components/primitives/QueryBoundary";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import { useCaretaker, useSendCaretakerInquiry } from "@/patient/hooks/marketplace";

export default function CaretakerDetailPage({
  params,
}: {
  params: Promise<{ caretakerId: string }>;
}) {
  const { caretakerId } = use(params);
  const query = useCaretaker(caretakerId);
  const send = useSendCaretakerInquiry();
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await send.mutateAsync({ id: caretakerId, message });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your message.");
    }
  }

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/marketplace"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to marketplace
      </Link>

      <QueryBoundary
        query={query}
        loadingCount={2}
        emptyTitle="Caretaker not found"
      >
        {(data) => {
          const c = data.caretaker;
          return (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              <div className="flex flex-col gap-5 lg:col-span-8">
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                    {c.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.photoUrl}
                        alt=""
                        className="h-20 w-20 rounded-pill object-cover"
                      />
                    ) : (
                      <div
                        className="grid h-20 w-20 place-items-center text-2xl font-bold text-white"
                        style={{
                          borderRadius: "var(--radius-pill)",
                          background:
                            "linear-gradient(145deg, var(--color-brand) 0%, var(--color-brand-strong) 100%)",
                        }}
                        aria-hidden
                      >
                        {c.name?.[0]?.toUpperCase() ?? "?"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h1 className="text-xl font-bold text-text">{c.name}</h1>
                        {c.verified ? (
                          <BadgeCheck size={16} aria-hidden className="text-success" />
                        ) : null}
                      </div>
                      {c.city ? (
                        <p className="mt-1 inline-flex items-center gap-1 text-sm text-text-soft">
                          <MapPin size={12} aria-hidden /> {c.city}
                        </p>
                      ) : null}
                      {c.rating ? (
                        <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-amber-600">
                          <Star size={12} aria-hidden /> {c.rating.toFixed(1)} · {c.reviewCount} reviews
                        </p>
                      ) : null}
                      {c.hourlyRate ? (
                        <p className="mt-2 text-base font-extrabold text-text">
                          LKR {c.hourlyRate.toLocaleString()}/hour
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>

                {c.services.length > 0 ? (
                  <Card>
                    <h2 className="text-sm font-bold text-text">Services</h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {c.services.map((s) => (
                        <StatusPill key={s} tone="brand">
                          {s.replace(/_/g, " ")}
                        </StatusPill>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {c.bio ? (
                  <Card>
                    <h2 className="text-sm font-bold text-text">About</h2>
                    <p className="mt-2 text-sm text-text-soft">{c.bio}</p>
                  </Card>
                ) : null}
              </div>

              <div className="flex flex-col gap-5 lg:col-span-4">
                <Card accent="brand">
                  {sent ? (
                    <div className="flex flex-col items-center gap-2 py-4 text-center">
                      <div className="grid h-12 w-12 place-items-center rounded-full bg-success-soft text-success">
                        <Check size={20} aria-hidden />
                      </div>
                      <p className="text-sm font-semibold text-text">Inquiry sent</p>
                      <p className="text-xs text-text-soft">
                        They'll reach out to you soon.
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={onSubmit} className="flex flex-col gap-3">
                      <h3 className="text-sm font-bold text-text">Send inquiry</h3>
                      <p className="text-xs text-text-soft">
                        Describe what you need. The caretaker will reply via the
                        app.
                      </p>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        rows={5}
                        required
                        placeholder="Hi, I'm looking for help with…"
                        className="w-full rounded-inner border border-border bg-surface-2 px-3 py-2 text-sm text-text outline-none focus:border-brand"
                      />
                      {error ? (
                        <p role="alert" className="text-sm text-danger">
                          {error}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={send.isPending || !message.trim()}
                        className="inline-flex items-center justify-center gap-1.5 rounded-pill bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {send.isPending ? (
                          <>
                            <Loader2 size={14} className="animate-spin" />
                            Sending…
                          </>
                        ) : (
                          <>
                            <Send size={14} aria-hidden /> Send
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </Card>
              </div>
            </div>
          );
        }}
      </QueryBoundary>
    </div>
  );
}
