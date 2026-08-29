"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Bell, Save, Check, Mail, MessageSquare, Smartphone } from "lucide-react";

import { Card } from "@/patient/components/primitives/Card";
import { SectionHeader } from "@/patient/components/primitives/SectionHeader";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "@/patient/hooks/notifications-feed";

export default function NotificationPreferencesPage() {
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [appointments, setAppointments] = useState(true);
  const [prescriptions, setPrescriptions] = useState(true);
  const [labResults, setLabResults] = useState(true);
  const [reminders, setReminders] = useState(true);
  const [marketing, setMarketing] = useState(false);
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [saved, setSaved] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (prefs.data && !hydrated) {
      const p = prefs.data;
      setPushEnabled(Boolean(p.pushEnabled));
      setEmailEnabled(Boolean(p.emailEnabled));
      setSmsEnabled(Boolean(p.smsEnabled));
      setAppointments(Boolean(p.appointments));
      setPrescriptions(Boolean(p.prescriptions));
      setLabResults(Boolean(p.labResults));
      setReminders(Boolean(p.reminders));
      setMarketing(Boolean(p.marketing));
      if (p.quietHours?.start) setQuietStart(p.quietHours.start);
      if (p.quietHours?.end) setQuietEnd(p.quietHours.end);
      setHydrated(true);
    }
  }, [prefs.data, hydrated]);

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

  return (
    <div className="flex flex-col gap-6 px-1 pb-4 pt-1 sm:px-2">
      <Link
        href="/patient/notifications"
        className="inline-flex items-center gap-1 text-xs font-semibold text-text-soft transition-colors hover:text-brand"
      >
        <ChevronLeft size={14} aria-hidden /> Back to notifications
      </Link>

      <SectionHeader
        label="Notifications"
        title="Preferences"
        description="Choose what we tell you about and how. Updates apply across web and mobile."
        action={
          saved ? (
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-success-soft px-3 py-1.5 text-xs font-semibold text-success">
              <Check size={12} aria-hidden /> Saved
            </span>
          ) : null
        }
      />

      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-text">Channels</h2>
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
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-text">Topics</h2>
          <Toggle
            icon={<Bell size={16} aria-hidden />}
            label="Appointments"
            description="Confirmations, reminders, reschedules"
            checked={appointments}
            onChange={setAppointments}
          />
          <Toggle
            icon={<Bell size={16} aria-hidden />}
            label="Prescriptions"
            description="New prescriptions and refills"
            checked={prescriptions}
            onChange={setPrescriptions}
          />
          <Toggle
            icon={<Bell size={16} aria-hidden />}
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
            icon={<Bell size={16} aria-hidden />}
            label="Product news"
            description="Occasional updates about new features"
            checked={marketing}
            onChange={setMarketing}
          />
        </div>
      </Card>

      <Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-bold text-text">Quiet hours</h2>
          <p className="text-xs text-text-soft">
            Pause non-urgent notifications between these times. Emergencies will
            still come through.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="t-label block">From</label>
              <input
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
            <div>
              <label className="t-label block">To</label>
              <input
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                className="mt-2 h-11 w-full rounded-pill border border-border bg-surface-2 px-4 text-sm text-text outline-none focus:border-brand"
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={update.isPending}
          className="inline-flex items-center gap-1.5 rounded-pill bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          <Save size={14} aria-hidden />
          {update.isPending ? "Saving…" : "Save preferences"}
        </button>
      </div>
    </div>
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
    <label className="flex items-center gap-3 rounded-inner bg-surface-2 p-3 cursor-pointer">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-pill bg-brand-soft text-brand">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="text-xs text-text-soft">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-pill transition-colors ${
          checked ? "bg-brand" : "bg-surface-3"
        }`}
        aria-pressed={checked}
        role="switch"
      >
        <span
          aria-hidden
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}
