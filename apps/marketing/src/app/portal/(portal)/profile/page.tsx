"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Save,
  Camera,
} from "lucide-react";
import { z } from "zod";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Input } from "@/portal/components/ui/Form";
import {
  RHFFormProvider,
  RHFInput,
  RHFTextarea,
} from "@/portal/components/ui/FormKit";
import { Skeleton } from "@/portal/components/ui/Empty";
import { toast } from "@/portal/components/ui/Toast";
import { useT } from "@/portal/i18n";

interface DoctorProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  specialization: string;
  slmcRegistrationNo: string | null;
  qualification: string | null;
  yearsOfExperience: number | null;
  consultationFee: number | null;
  photo: string | null;
}

// Editable subset of profile fields (matches PATCH /doctor/profile surface).
const profileSchema = z.object({
  specialization: z.string().min(1, "Specialization is required").max(100),
  slmcRegistrationNo: z.string().max(50).optional().or(z.literal("")),
  qualification: z.string().max(500).optional().or(z.literal("")),
  yearsOfExperience: z
    .string()
    .refine((v) => !v || /^\d+$/.test(v), { message: "Must be a whole number" })
    .refine((v) => !v || Number(v) <= 80, { message: "Must be 80 or fewer" }),
  consultationFee: z
    .string()
    .refine((v) => !v || /^\d+(\.\d{1,2})?$/.test(v), { message: "Invalid amount" })
    .refine((v) => !v || Number(v) <= 10000000, { message: "Too large" }),
});

type ProfileValues = z.infer<typeof profileSchema>;

export default function ProfilePage() {
  const t = useT();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "me"],
    queryFn: () => api<{ doctor: DoctorProfile }>("/doctor/me"),
  });

  const updateMutation = useMutation({
    mutationFn: async (values: ProfileValues) => {
      const payload = {
        specialization: values.specialization,
        slmcRegistrationNo: values.slmcRegistrationNo || null,
        qualification: values.qualification || null,
        yearsOfExperience: values.yearsOfExperience ? Number(values.yearsOfExperience) : null,
        consultationFee: values.consultationFee ? Number(values.consultationFee) : null,
      };
      await api("/doctor/profile", {
        method: "PATCH",
        json: payload,
      });
    },
    onSuccess: () => {
      toast.success(t("settings.saved"), "");
      qc.invalidateQueries({ queryKey: ["doctor", "me"] });
      setEditing(false);
    },
    onError: (err: any) => {
      toast.error(t("toast.error"), err?.message);
    },
  });

  const doctor = data?.doctor;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doctor) {
    return null;
  }

  const defaults: ProfileValues = {
    specialization: doctor.specialization ?? "",
    slmcRegistrationNo: doctor.slmcRegistrationNo ?? "",
    qualification: doctor.qualification ?? "",
    yearsOfExperience: doctor.yearsOfExperience != null ? String(doctor.yearsOfExperience) : "",
    consultationFee: doctor.consultationFee != null ? String(doctor.consultationFee) : "",
  };

  return (
    <RHFFormProvider
      schema={profileSchema}
      defaultValues={defaults}
      mode="onSubmit"
    >
      {(form) => {
        // Reset form when leaving edit mode so cancelled changes don't stick.
        useEffect(() => {
          if (!editing) form.reset(defaults);
        }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps
        return (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-text">{t("profile.title")}</h1>
                <p className="text-sm text-text-soft mt-1">{t("profile.subtitle")}</p>
              </div>
              {!editing ? (
                <Button onClick={() => setEditing(true)}>{t("common.edit")}</Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="button"
                    leftIcon={<Save size={14} />}
                    onClick={form.handleSubmit((values) => updateMutation.mutate(values))}
                    loading={updateMutation.isPending}
                  >
                    {t("common.save")}
                  </Button>
                </div>
              )}
            </div>

            {/* Photo */}
            <Card>
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-20 w-20 rounded-full bg-brand-soft text-brand flex items-center justify-center text-2xl font-semibold">
                    {doctor.photo ? (
                      <img
                        src={doctor.photo}
                        alt={doctor.name}
                        className="h-full w-full rounded-full object-cover"
                      />
                    ) : (
                      doctor.name?.charAt(0) || "D"
                    )}
                  </div>
                  {editing && (
                    <button
                      type="button"
                      className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-brand text-white flex items-center justify-center"
                    >
                      <Camera size={14} />
                    </button>
                  )}
                </div>
                <div>
                  <div className="text-lg font-semibold text-text">{doctor.name}</div>
                  <div className="text-sm text-text-soft">{doctor.specialization}</div>
                  {doctor.slmcRegistrationNo && (
                    <div className="text-xs text-text-muted mt-1">
                      SLMC: {doctor.slmcRegistrationNo}
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Personal Info — read-only here. Name/email/phone live on
                `users` and require a separate OTP-verified flow we haven't
                shipped yet, so the profile page shows them but won't accept
                edits. Specialization is the one personal-info field we DO
                surface here for quick tweaks. */}
            <Card>
              <CardHeader title={t("profile.personalInfo")} />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t("settings.name")}
                  value={doctor.name}
                  readOnly
                  disabled
                />
                <Input
                  label={t("settings.email")}
                  value={doctor.email}
                  readOnly
                  disabled
                />
                <Input
                  label={t("settings.phone")}
                  value={doctor.phone ?? ""}
                  readOnly
                  disabled
                />
                {editing ? (
                  <RHFInput
                    name="specialization"
                    label={t("settings.specialty")}
                    required
                  />
                ) : (
                  <Input
                    label={t("settings.specialty")}
                    value={doctor.specialization}
                    disabled
                  />
                )}
              </div>
            </Card>

            {/* Professional Info */}
            <Card>
              <CardHeader title={t("profile.professionalInfo")} />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {editing ? (
                  <>
                    <RHFInput name="slmcRegistrationNo" label={t("settings.slmc")} />
                    <RHFInput
                      name="yearsOfExperience"
                      label={t("settings.experience")}
                      type="number"
                    />
                    <RHFInput
                      name="consultationFee"
                      label={t("settings.consultationFee")}
                      type="number"
                    />
                    <div className="md:col-span-2">
                      <RHFTextarea
                        name="qualification"
                        label={t("settings.qualifications")}
                        rows={3}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Input
                      label={t("settings.slmc")}
                      value={doctor.slmcRegistrationNo ?? ""}
                      disabled
                    />
                    <Input
                      label={t("settings.experience")}
                      type="number"
                      value={(doctor.yearsOfExperience ?? "").toString()}
                      disabled
                    />
                    <Input
                      label={t("settings.consultationFee")}
                      type="number"
                      value={(doctor.consultationFee ?? "").toString()}
                      disabled
                    />
                    <div className="md:col-span-2">
                      <label className="block text-[11px] text-text-soft mb-1">
                        {t("settings.qualifications")}
                      </label>
                      <p className="text-sm text-text whitespace-pre-wrap min-h-[44px] px-3 py-2 rounded-xl bg-surface-2/40 border border-border/50">
                        {doctor.qualification || "—"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </Card>

            {/* Bio card removed: PATCH /doctor/profile does not accept a bio
                column (no `users.bio`, no `doctors.bio`). Re-add when the
                schema grows a bio column and the backend endpoint surfaces
                it. The t("profile.bio") / t("profile.bioPlaceholder") keys
                are intentionally kept so the i18n catalogue is consistent
                with future plans. */}
          </div>
        );
      }}
    </RHFFormProvider>
  );
}
