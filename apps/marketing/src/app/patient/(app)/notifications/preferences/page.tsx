"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  FlaskConical,
  Mail,
  Megaphone,
  MessageSquare,
  Moon,
  Pill,
  Save,
  Settings2,
  Smartphone,
} from "lucide-react";

import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/patient/hooks/notifications-feed";
import { cn } from "@/portal/lib/utils";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  HERO_CHIP,
  HeroAccent,
  PANEL,
  PanelHeader,
  PanelSkeleton,
  PatientHero,
  PatientPage,
} from "@/patient/components/workspace";

interface PrefsShape {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  appointments?: boolean;
  prescriptions?: boolean;
  labResults?: boolean;
  reminders?: boolean;
  marketing?: boolean;
  quietHours?: { start?: string; end?: string } | null;
}

export default function NotificationPreferencesPage() {
  const prefs = useNotificationPreferences();

  if (prefs.isLoading) {
    return (
      <PatientPage>
        <div className="h-44 animate-pulse rounded-[20px] bg-slate-100" />
        <section className={PANEL}>
          <PanelSkeleton rows={4} />
        </section>
      </PatientPage>
    );
  }

  return <PrefsForm initial={(prefs.data ?? {}) as PrefsShape} />;
}

function PrefsForm({ initial }: { initial: PrefsShape }) {
  const update = useUpdateNotificationPreferences();

  const [pushEnabled, setPushEnabled] = useState(Boolean(initial.pushEnabled ?? true));
  const [emailEnabled, setEmailEnabled] = useState(Boolean(initial.emailEnabled ?? true));
  const [smsEnabled, setSmsEnabled] = useState(Boolean(initial.smsEnabled));
  const [appointments, setAppointments] = useState(Boolean(initial.appointments ?? true));
  const [prescriptions, setPrescriptions] = useState(Boolean(initial.prescriptions ?? true));
  const [labResults, setLabResults] = useState(Boolean(initial.labResults ?? true));
  const [reminders, setReminders] = useState(Boolean(initial.reminders ?? true));
  const [marketing, setMarketing] = useState(Boolean(initial.marketing));
  const [quietStart, setQuietStart] = useState(initial.quietHours?.start ?? "");
  const [quietEnd, setQuietEnd] = useState(initial.quietHours?.end ?? "");
  const [saved, setSaved] = useState(false);

  async function onSave() {
    try {
      await update.mutateAsync({
        pushEnabled,
        emailEnabled,
        smsEnabled,
        appointments,
        prescriptions,
        labResults,
        reminders,
        marketing,
        quietHours:
          quietStart && quietEnd
            ? { start: quietStart, end: quietEnd }
            : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // ignore
    }
  }

  const channelsOn = [pushEnabled, emailEnabled, smsEnabled].filter(Boolean).length;
  const topicsOn = [appointments, prescriptions, labResults, reminders, marketing].filter(Boolean).length;

  return (
    <PatientPage>
      <div className="-mb-1">
        <Link
          href="/patient/notifications"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-sky-700"
        >
          <ArrowLeft size={14} /> Notifications
        </Link>
      </div>

      <PatientHero
        overlap={false}
        kickerIcon={<Settings2 size={13} aria-hidden />}
        kicker="Notifications"
        kickerMeta="Delivery preferences"
        title={
          <>
            Notification <HeroAccent>preferences</HeroAccent>
          </>
        }
        description="Choose what we tell you about and how. Updates apply across web and mobile."
        chips={
          <>
            <span className={HERO_CHIP}>{channelsOn}/3 channels on</span>
            <span className={HERO_CHIP}>{topicsOn}/5 topics on</span>
            {quietStart && quietEnd ? (
              <span className={HERO_CHIP}>
                <Moon size={12} className="text-violet-300" />
                Quiet {quietStart}–{quietEnd}
              </span>
            ) : null}
          </>
        }
        actions={
          saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-100">
              <Check size={12} aria-hidden /> Saved
            </span>
          ) : undefined
        }
      />

      <div className="mx-auto grid w-full max-w-4xl gap-5 lg:grid-cols-2">
        <section className={PANEL}>
          <PanelHeader
            icon={<Smartphone size={16} />}
            tone="bg-sky-50 text-sky-600"
            title="Channels"
            caption="Where alerts are delivered."
          />
          <div className="mt-4 flex flex-col gap-2.5">
            <Toggle
              icon={<Smartphone size={16} aria-hidden />}
              label="Push notifications"
              description="Instant alerts on this device"
              checked={pushEnabled}
              onChange={setPushEnabled}
            />
            <Toggle
              icon={<Mail size={16} aria-hidden />}
              label="Email"
              description="Daily summary and important events"
              checked={emailEnabled}
              onChange={setEmailEnabled}
            />
            <Toggle
              icon={<MessageSquare size={16} aria-hidden />}
              label="SMS"
              description="Critical updates only (carrier rates may apply)"
              checked={smsEnabled}
              onChange={setSmsEnabled}
            />
          </div>
        </section>

        <section className={PANEL}>
          <PanelHeader
            icon={<Bell size={16} />}
            tone="bg-violet-50 text-violet-600"
            title="Topics"
            caption="What we notify you about."
          />
          <div className="mt-4 flex flex-col gap-2.5">
            <Toggle
              icon={<Calendar size={16} aria-hidden />}
              label="Appointments"
              description="Confirmations, reminders, reschedules"
              checked={appointments}
              onChange={setAppointments}
            />
            <Toggle
              icon={<Pill size={16} aria-hidden />}
              label="Prescriptions"
              description="New prescriptions and refills"
              checked={prescriptions}
              onChange={setPrescriptions}
            />
            <Toggle
              icon={<FlaskConical size={16} aria-hidden />}
              label="Lab results"
              description="When reports are ready"
              checked={labResults}
              onChange={setLabResults}
            />
            <Toggle
              icon={<Bell size={16} aria-hidden />}
              label="Reminders"
              description="Medication and appointment nudges"
              checked={reminders}
              onChange={setReminders}
            />
            <Toggle
              icon={<Megaphone size={16} aria-hidden />}
              label="Product news"
              description="Occasional updates about new features"
              checked={marketing}
              onChange={setMarketing}
            />
          </div>
        </section>

        <section className={cn(PANEL, "lg:col-span-2")}>
          <PanelHeader
            icon={<Moon size={16} />}
            tone="bg-indigo-50 text-indigo-600"
            title="Quiet hours"
            caption="Pause non-urgent notifications — emergencies still come through."
          />
          <div className="mt-4 grid max-w-sm grid-cols-2 gap-3">
            <div>
              <label className={FIELD_LABEL}>From</label>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
            <div>
              <label className={FIELD_LABEL}>To</label>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className={FIELD_INPUT}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="mx-auto flex w-full max-w-4xl items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={update.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-sky-600 px-6 text-sm font-bold text-white transition hover:bg-sky-500 disabled:opacity-50"
        >
          <Save size={14} aria-hidden />
          {update.isPending ? "Saving…" : "Save preferences"}
        </button>
        {saved ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
            <Check size={13} aria-hidden /> Saved
          </span>
        ) : null}
      </div>
    </PatientPage>
  );
}

function Toggle({
  icon,
  label,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-50 text-sky-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-sky-600" : "bg-slate-300",
        )}
        aria-checked={checked}
        role="switch"
        aria-label={label}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
