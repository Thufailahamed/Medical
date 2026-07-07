"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { PageHeader } from "@/portal/components/ui/PageHeader";
import { Field, Input, Select } from "@/portal/components/ui/Form";
import { Button } from "@/portal/components/ui/Button";
import { adminApi } from "@/portal/lib/admin-api";
import { toast } from "@/portal/components/ui/Toast";

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState<string>("");
  const [audience, setAudience] = useState<"all" | "active">("active");

  const broadcast = useMutation({
    mutationFn: () =>
      adminApi("/admin/notifications/broadcast", {
        method: "POST",
        json: {
          title: title.trim(),
          body: body.trim(),
          role: role || undefined,
          audience,
        },
      }),
    onSuccess: (res: any) => toast.success(`Broadcast sent to ${res.sent} users`),
    onError: (e: any) => toast.error("Failed", e.message),
  });

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <PageHeader title="Broadcast notification" subtitle="Send a system-wide message to all matching users." icon={<Megaphone size={20} className="text-amber-600" />} />

      <form
        className="bg-surface border border-border rounded-2xl p-6 flex flex-col gap-5"
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
          <Input id="bcast-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Body" htmlFor="bcast-body" required>
          <textarea
            id="bcast-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/30"
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

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <p className="text-xs text-text-soft max-w-md">
            Broadcasts are written to each user's notifications table. Other admins are excluded by default to prevent loops.
          </p>
          <Button type="submit" loading={broadcast.isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
            Send broadcast
          </Button>
        </div>
      </form>
    </div>
  );
}