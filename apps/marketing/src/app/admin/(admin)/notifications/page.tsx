"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  CalendarClock,
  Eye,
  Info,
  Megaphone,
  Send,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import { cn } from "@/portal/lib/utils";
import {
  DoctorHero,
  HERO_CHIP,
  HeroOverlap,
  PANEL,
  PanelHeader,
  StatTile,
} from "@/portal/components/doctor/Workspace";
import { humanize } from "@/portal/components/admin/AdminDirectory";
import { Field, Input, Select } from "@/portal/components/ui/Form";
import { Button } from "@/portal/components/ui/Button";
import { adminApi, adminQk } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState<string>("");
  const [audience, setAudience] = useState<"all" | "active">("active");

  // Broadcast volume — shares the dashboard's cache entry.
  const { data: dash } = useQuery({
    queryKey: adminQk.dashboard(),
    queryFn: () =>
      adminApi<{ marketing: { broadcastsSent: number; broadcastsLast7d: number } }>("/admin/dashboard"),
    staleTime: 60_000,
  });

  const broadcast = useMutation({
    mutationFn: () =>
      adminApi<{ sent: number }>("/admin/notifications/broadcast", {
        method: "POST",
        json: {
          title: title.trim(),
          body: body.trim(),
          role: role || undefined,
          audience,
        },
      }),
    onSuccess: (res) => {
      toast.success(`Broadcast sent to ${res.sent} users`);
      setTitle("");
      setBody("");
    },
    onError: (e: unknown) => toast.error("Failed", e instanceof Error ? e.message : undefined),
  });

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 pb-10 [&_a:hover]:no-underline">
      {/* ── Hero + floating stat strip ─────────────────────────────────── */}
      <div>
        <DoctorHero
          kickerIcon={<Megaphone size={13} aria-hidden />}
          kicker="System"
          kickerMeta="Broadcasts"
          title={
            <>
              Broadcast{" "}
              <span className="bg-gradient-to-r from-sky-200 via-white to-teal-200 bg-clip-text text-transparent">
                composer
              </span>
            </>
          }
          description="Send a system-wide notification to every matching user. Broadcasts land in each user's notification tray instantly."
          chips={
            <>
              <span className={HERO_CHIP}>
                <Users size={12} className="text-emerald-300" aria-hidden />
                {audience === "active" ? "Active users only" : "All users incl. pending"}
              </span>
              {role ? (
                <span className="inline-flex items-center gap-2 rounded-lg border border-amber-300/30 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100">
                  <UserCheck size={12} aria-hidden />
                  Role: {humanize(role)}
                </span>
              ) : null}
            </>
          }
        />

        <HeroOverlap className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <StatTile
            label="Broadcasts sent"
            icon={<Send size={16} />}
            tone="bg-violet-50 text-violet-600"
            value={dash ? dash.marketing.broadcastsSent.toLocaleString() : "…"}
            sub="Lifetime"
          />
          <StatTile
            label="This week"
            icon={<CalendarClock size={16} />}
            tone="bg-sky-50 text-sky-600"
            value={dash ? String(dash.marketing.broadcastsLast7d) : "…"}
            sub="Sent in the last 7 days"
          />
          <StatTile
            label="Audience"
            icon={<Users size={16} />}
            tone="bg-emerald-50 text-emerald-600"
            value={audience === "active" ? "Active" : "All"}
            sub="Click to toggle"
            active={audience === "all"}
            onClick={() => setAudience((a) => (a === "active" ? "all" : "active"))}
          />
          <StatTile
            label="Target role"
            icon={<UserCheck size={16} />}
            tone="bg-amber-50 text-amber-600"
            value={role ? humanize(role) : "All roles"}
            sub="Set in the form below"
          />
        </HeroOverlap>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
        <section className={cn(PANEL, "min-w-0 xl:col-span-8")} aria-labelledby="bcast-form">
          <PanelHeader
            id="bcast-form"
            icon={<Megaphone size={16} />}
            tone="bg-rose-50 text-rose-600"
            title="Compose broadcast"
            caption="Title up to 120 chars · body up to 500"
          />
          <form
            className="mt-5 flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (title.trim().length < 1 || body.trim().length < 1) {
                toast.error("Title and body required");
                return;
              }
              broadcast.mutate();
            }}
          >
            <Field label="Title" htmlFor="bcast-title" required>
              <Input
                id="bcast-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={120}
                placeholder="e.g. Scheduled maintenance this Sunday"
              />
            </Field>
            <Field label="Body" htmlFor="bcast-body" required>
              <textarea
                id="bcast-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Write the message users will see…"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Target role" htmlFor="bcast-role">
                <Select id="bcast-role" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="">All roles</option>
                  <option value="patient">Patients</option>
                  <option value="doctor">Doctors</option>
                  <option value="pharmacy">Pharmacies</option>
                  <option value="laboratory">Laboratories</option>
                  <option value="insurance">Insurance</option>
                  <option value="ambulance">Ambulance</option>
                  <option value="hospital_admin">Hospital admins</option>
                  <option value="hospital_staff">Hospital staff</option>
                </Select>
              </Field>
              <Field label="Audience" htmlFor="bcast-audience">
                <Select id="bcast-audience" value={audience} onChange={(e) => setAudience(e.target.value as "all" | "active")}>
                  <option value="active">Active only</option>
                  <option value="all">All users (incl. pending)</option>
                </Select>
              </Field>
            </div>

            <div className="flex items-center justify-end border-t border-slate-100 pt-4">
              <Button
                type="submit"
                loading={broadcast.isPending}
                className="bg-[#07233a] text-white hover:bg-sky-700"
              >
                <Send size={14} className="mr-1" />
                Send broadcast
              </Button>
            </div>
          </form>
        </section>

        <aside className="flex min-w-0 flex-col gap-6 xl:col-span-4" aria-label="Broadcast details">
          {/* Live preview */}
          <section className={PANEL} aria-labelledby="bcast-preview">
            <PanelHeader
              id="bcast-preview"
              icon={<Eye size={16} />}
              tone="bg-sky-50 text-sky-600"
              title="Preview"
              caption="What recipients will see"
            />
            <div className="mt-5 rounded-xl bg-slate-50 p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-lg shadow-sky-500/30 ring-1 ring-inset ring-white/20">
                  <Bell size={17} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900">
                    {title.trim() || "Notification title"}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
                    {body.trim() || "The body of your broadcast will appear here as you type."}
                  </span>
                  <span className="mt-2 block text-[11px] text-slate-400">
                    HealthHub · just now
                  </span>
                </span>
              </div>
            </div>
          </section>

          {/* How it works */}
          <section className={PANEL} aria-labelledby="bcast-how">
            <PanelHeader
              id="bcast-how"
              icon={<Info size={16} />}
              tone="bg-violet-50 text-violet-600"
              title="How broadcasts work"
            />
            <ul className="mt-4 flex flex-col gap-3">
              {[
                {
                  icon: <Bell size={13} />,
                  text: "Written to each matching user's notifications table and shown in their tray.",
                },
                {
                  icon: <ShieldCheck size={13} />,
                  text: "Other admins are excluded by default to prevent notification loops.",
                },
                {
                  icon: <Send size={13} />,
                  text: "Delivery is immediate — broadcasts cannot be recalled once sent.",
                },
              ].map((tip, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500" aria-hidden>
                    {tip.icon}
                  </span>
                  <span className="text-xs leading-relaxed text-slate-500">{tip.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
