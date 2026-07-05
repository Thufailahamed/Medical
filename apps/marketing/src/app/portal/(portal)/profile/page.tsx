"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  User,
  Mail,
  Phone,
  Shield,
  Save,
  Camera,
} from "lucide-react";

import { api } from "@/portal/lib/api";
import { Card, CardHeader } from "@/portal/components/ui/Card";
import { Button } from "@/portal/components/ui/Button";
import { Input, Textarea } from "@/portal/components/ui/Form";
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
  bio: string | null;
  photo: string | null;
}

export default function ProfilePage() {
  const t = useT();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["doctor", "me"],
    queryFn: () => api<{ doctor: DoctorProfile }>("/doctor/me"),
  });

  const [form, setForm] = useState<Partial<DoctorProfile>>({});
  const [editing, setEditing] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<DoctorProfile>) => {
      await api("/doctor/profile", {
        method: "PATCH",
        json: updates,
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

  const handleChange = (field: keyof DoctorProfile, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateMutation.mutate(form);
  };

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
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              leftIcon={<Save size={14} />}
              onClick={handleSave}
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

      {/* Personal Info */}
      <Card>
        <CardHeader title={t("profile.personalInfo")} />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("settings.name")}
            value={editing ? (form.name ?? doctor.name) : doctor.name}
            onChange={(e) => handleChange("name", e.target.value)}
            disabled={!editing}
          />
          <Input
            label={t("settings.email")}
            value={editing ? (form.email ?? doctor.email) : doctor.email}
            onChange={(e) => handleChange("email", e.target.value)}
            disabled={!editing}
          />
          <Input
            label={t("settings.phone")}
            value={editing ? (form.phone ?? doctor.phone ?? "") : doctor.phone ?? ""}
            onChange={(e) => handleChange("phone", e.target.value)}
            disabled={!editing}
          />
          <Input
            label={t("settings.specialty")}
            value={editing ? (form.specialization ?? doctor.specialization) : doctor.specialization}
            onChange={(e) => handleChange("specialization", e.target.value)}
            disabled={!editing}
          />
        </div>
      </Card>

      {/* Professional Info */}
      <Card>
        <CardHeader title={t("profile.professionalInfo")} />
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("settings.slmc")}
            value={
              editing
                ? (form.slmcRegistrationNo ?? doctor.slmcRegistrationNo ?? "")
                : doctor.slmcRegistrationNo ?? ""
            }
            onChange={(e) => handleChange("slmcRegistrationNo", e.target.value)}
            disabled={!editing}
          />
          <Input
            label={t("settings.experience")}
            type="number"
            value={
              editing
                ? (form.yearsOfExperience ?? doctor.yearsOfExperience ?? "").toString()
                : (doctor.yearsOfExperience ?? "").toString()
            }
            onChange={(e) => handleChange("yearsOfExperience", parseInt(e.target.value) || null)}
            disabled={!editing}
          />
          <Input
            label={t("settings.consultationFee")}
            type="number"
            value={
              editing
                ? (form.consultationFee ?? doctor.consultationFee ?? "").toString()
                : (doctor.consultationFee ?? "").toString()
            }
            onChange={(e) => handleChange("consultationFee", parseInt(e.target.value) || null)}
            disabled={!editing}
          />
          <div className="md:col-span-2">
            <label className="block text-[11px] text-text-soft mb-1">
              {t("settings.qualifications")}
            </label>
            <Textarea
              value={
                editing
                  ? (form.qualification ?? doctor.qualification ?? "")
                  : doctor.qualification ?? ""
              }
              onChange={(e) => handleChange("qualification", e.target.value)}
              disabled={!editing}
              rows={3}
            />
          </div>
        </div>
      </Card>

      {/* Bio */}
      <Card>
        <CardHeader title={t("profile.bio")} />
        <div className="mt-4">
          <Textarea
            value={editing ? (form.bio ?? doctor.bio ?? "") : doctor.bio ?? ""}
            onChange={(e) => handleChange("bio", e.target.value)}
            disabled={!editing}
            placeholder={t("profile.bioPlaceholder")}
            rows={4}
          />
        </div>
      </Card>
    </div>
  );
}
