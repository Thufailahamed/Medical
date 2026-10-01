"use client";

import { use, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  ChevronLeft,
  FileText,
  HeartHandshake,
  Inbox,
  Languages,
  Loader2,
  MapPin,
  Send,
  ShieldCheck,
  UserSearch,
} from "lucide-react";

import {
  Badge,
  EmptyBlock,
  FIELD_TEXTAREA,
  GROUP_LABEL,
  HERO_CHIP,
  HERO_GHOST,
  HERO_PRIMARY,
  HeroAccent,
  HeroOverlap,
  HeroTile,
  PANEL,
  PRIMARY_BTN,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
  PromoCard,
  QuickToolsPanel,
  StatTile,
} from "@/patient/components/workspace";
import {
  useCaretaker,
  useSendCaretakerInquiry,
} from "@/patient/hooks/marketplace";
import { humanize } from "@/patient/lib/format";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  si: "Sinhala",
  ta: "Tamil",
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

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
    if (message.trim().length < 10) {
      setError("Please describe what you need in at least 10 characters.");
      return;
    }
    try {
      await send.mutateAsync({ id: caretakerId, patientMessage: message.trim() });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't send your message.",
      );
    }
  }

  const c = query.data?.caretaker;

  if (!c) {
    return (
      <PatientPage>
        <PatientHero
          overlap={false}
          kickerIcon={<HeartHandshake size={13} aria-hidden />}
          kicker="Caretaker marketplace"
          title={query.isLoading ? "Loading profile…" : "Caretaker not found"}
          description={
            query.isLoading
              ? "Fetching this caretaker's marketplace profile."
              : "This listing may be unavailable or no longer verified."
          }
          actions={
            <Link href="/patient/marketplace" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              Marketplace
            </Link>
          }
        />
        <section className={PANEL}>
          {query.isLoading ? (
            <PanelSkeleton rows={3} className="mt-0" />
          ) : query.isError ? (
            <PanelError onRetry={() => void query.refetch()} />
          ) : (
            <EmptyBlock
              className="mt-0"
              icon={<UserSearch size={19} />}
              title="No such listing"
              body="The caretaker may have paused their listing or failed re-verification."
            />
          )}
        </section>
      </PatientPage>
    );
  }

  return (
    <PatientPage>
      <PatientHero
        leading={
          <HeroTile tone="from-teal-400 to-emerald-600">
            {c.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.photo}
                alt={`${c.name} portrait`}
                className="h-full w-full rounded-[20px] object-cover"
              />
            ) : (
              <span className="text-2xl font-bold">{getInitials(c.name)}</span>
            )}
          </HeroTile>
        }
        kickerIcon={<HeartHandshake size={13} aria-hidden />}
        kicker="Caretaker marketplace"
        kickerMeta={c.district ?? "Home care"}
        title={
          <>
            {c.name} <HeroAccent>· care at home</HeroAccent>
          </>
        }
        description={c.bio ?? "Verified caretaker available for home visits."}
        chips={
          <>
            {c.verified ? (
              <span className={HERO_CHIP}>
                <BadgeCheck size={12} className="text-emerald-300" aria-hidden />
                Identity verified
              </span>
            ) : null}
            {c.district ? (
              <span className={HERO_CHIP}>
                <MapPin size={12} className="text-sky-300" aria-hidden />
                {c.district}
              </span>
            ) : null}
            {c.hourlyRateLkr ? (
              <span className={HERO_CHIP}>
                LKR {c.hourlyRateLkr.toLocaleString()}/hour
              </span>
            ) : null}
            {c.experienceYears > 0 ? (
              <span className={HERO_CHIP}>
                <Briefcase size={12} className="text-amber-300" aria-hidden />
                {c.experienceYears} yrs experience
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Link href="/patient/marketplace" className={HERO_GHOST}>
              <ChevronLeft size={15} aria-hidden />
              Marketplace
            </Link>
            <a href="#send-inquiry" className={HERO_PRIMARY}>
              <Send size={14} className="text-sky-600" aria-hidden />
              Send inquiry
            </a>
          </>
        }
      />

      <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile
          icon={<Briefcase size={16} />}
          tone="bg-emerald-50 text-emerald-600"
          label="Hourly rate"
          value={c.hourlyRateLkr ? `LKR ${c.hourlyRateLkr.toLocaleString()}` : "—"}
          sub={c.hourlyRateLkr ? "Per hour, negotiable" : "On request"}
        />
        <StatTile
          icon={<BadgeCheck size={16} />}
          tone="bg-sky-50 text-sky-600"
          label="Experience"
          value={c.experienceYears > 0 ? String(c.experienceYears) : "—"}
          unit={c.experienceYears > 0 ? "yrs" : undefined}
          sub="Providing home care"
        />
        <StatTile
          icon={<Languages size={16} />}
          tone="bg-violet-50 text-violet-600"
          label="Languages"
          value={String(c.languages.length)}
          sub={
            c.languages.length > 0
              ? c.languages
                  .map((l) => LANGUAGE_NAMES[l] ?? l.toUpperCase())
                  .join(", ")
              : "Not specified"
          }
        />
        <StatTile
          icon={<HeartHandshake size={16} />}
          tone="bg-amber-50 text-amber-600"
          label="Care roles"
          value={String(c.careRolesOffered.length)}
          sub={c.isAvailable === false ? "Currently unavailable" : "Open to inquiries"}
        />
      </HeroOverlap>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 xl:col-span-8">
          <section className={PANEL} aria-labelledby="cd-about">
            <PanelHeader
              id="cd-about"
              icon={<FileText size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="About"
              caption="From the caretaker's marketplace listing"
            />
            {c.bio ? (
              <p className="mt-5 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                {c.bio}
              </p>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                This caretaker has not added a bio yet — send an inquiry to
                learn more about their experience.
              </p>
            )}
          </section>

          <section className={PANEL} aria-labelledby="cd-roles">
            <PanelHeader
              id="cd-roles"
              icon={<HeartHandshake size={16} />}
              tone="bg-emerald-50 text-emerald-600"
              title="Care roles & languages"
              caption="What this caretaker offers"
            />
            <div className="mt-5">
              <p className={GROUP_LABEL}>Care roles</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.careRolesOffered.length > 0 ? (
                  c.careRolesOffered.map((r) => (
                    <Badge key={r} tone="emerald">
                      {humanize(r)}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">Not specified</span>
                )}
              </div>
            </div>
            <div className="mt-5">
              <p className={GROUP_LABEL}>Languages</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.languages.length > 0 ? (
                  c.languages.map((l) => (
                    <Badge key={l} tone="violet">
                      {LANGUAGE_NAMES[l] ?? l.toUpperCase()}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">Not specified</span>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside
          className="flex min-w-0 flex-col gap-6 xl:col-span-4"
          aria-label="Contact caretaker"
        >
          <section className={PANEL} id="send-inquiry" aria-labelledby="cd-inquiry">
            <PanelHeader
              id="cd-inquiry"
              icon={<Send size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Send an inquiry"
              caption="The caretaker replies via the app"
            />
            {sent ? (
              <div className="mt-5 flex flex-col items-center rounded-xl bg-emerald-50/60 px-6 py-7 text-center">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-emerald-600 shadow-[0_1px_2px_rgba(15,23,42,0.05),inset_0_0_0_1px_rgba(15,23,42,0.07)]">
                  <CheckCircle2 size={19} aria-hidden />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  Inquiry sent
                </p>
                <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
                  The caretaker will review your request and respond shortly.
                </p>
                <Link
                  href="/patient/marketplace/inquiries"
                  className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#07233a] px-3.5 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
                >
                  <Inbox size={13} aria-hidden />
                  View my inquiries
                </Link>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-3">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={6}
                  required
                  minLength={10}
                  maxLength={500}
                  placeholder="Hi, I'm looking for help with…"
                  aria-label="Message to caretaker"
                  className={FIELD_TEXTAREA}
                />
                <p className="text-[11px] text-slate-400">
                  Describe the care needed, schedule, and location. 10–500
                  characters.
                </p>
                {error ? (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-600"
                  >
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                  </div>
                ) : null}
                <button
                  type="submit"
                  disabled={send.isPending || message.trim().length < 10}
                  className={PRIMARY_BTN}
                >
                  {send.isPending ? (
                    <Loader2 size={13} className="animate-spin" aria-hidden />
                  ) : (
                    <Send size={13} aria-hidden />
                  )}
                  {send.isPending ? "Sending…" : "Send inquiry"}
                </button>
              </form>
            )}
          </section>

          <QuickToolsPanel
            id="cd-tools"
            title="Marketplace"
            tools={[
              {
                icon: HeartHandshake,
                label: "Browse",
                hint: "All caretakers",
                href: "/patient/marketplace",
                tone: "from-sky-500 to-blue-600 shadow-sky-500/30",
              },
              {
                icon: Inbox,
                label: "Inquiries",
                hint: "Your requests",
                href: "/patient/marketplace/inquiries",
                tone: "from-amber-500 to-orange-600 shadow-amber-500/30",
              },
              {
                icon: ShieldCheck,
                label: "Caretakers",
                hint: "Shared access",
                href: "/patient/caretakers",
                tone: "from-emerald-500 to-teal-600 shadow-emerald-500/30",
              },
            ]}
          />

          <PromoCard
            icon={<ShieldCheck size={21} aria-hidden />}
            kicker="Verified only"
            title="Identity-checked"
            body="Only caretakers who cleared verification appear in the marketplace."
            href="/patient/caretakers"
          />
        </aside>
      </div>
    </PatientPage>
  );
}
