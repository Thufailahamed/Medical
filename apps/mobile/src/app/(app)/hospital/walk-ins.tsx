// @ts-nocheck

import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Plus,
  AlertCircle,
  UserPlus,
  Users,
  CalendarClock,
  ChevronRight,
} from "lucide-react-native";
import {
  useWalkIns,
  useCreateWalkIn,
  useUpdateWalkIn,
  useWalkInSearch,
  useDoctorSearch,
} from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  Avatar,
  Skeleton,
  EmptyState,
  FormField,
  TextInput,
  Button,
  BottomSheet,
  useToast,
} from "@/components/ui";

export default function WalkInsScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const role = user?.role;
    if (
      role !== "hospital_admin" &&
      role !== "hospital_staff" &&
      role !== "doctor"
    ) {
      router.replace("/(app)");
    }
  }, [user, router]);

  const today = new Date().toISOString().slice(0, 10);
  const { data, isLoading } = useWalkIns({ date: today });
  const [open, setOpen] = useState(false);

  const walkIns: any[] = data?.walkIns || [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("hospitalWalkIns.title")}
        subtitle={t("hospitalWalkIns.subtitle", { count: walkIns.length })}
      />

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Button
          title={t("hospitalWalkIns.checkInAction")}
          icon={UserPlus}
          onPress={() => setOpen(true)}
        />

        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} height={120} radius={20} />
            ))}
          </View>
        ) : walkIns.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("hospitalWalkIns.emptyTitle")}
            message={t("hospitalWalkIns.emptyBody")}
          />
        ) : (
          <ScrollView contentContainerStyle={{ gap: spacing.md }}>
            {walkIns.map((w: any) => (
              <WalkInRow key={w.id} walkIn={w} />
            ))}
            <View style={{ height: 24 }} />
          </ScrollView>
        )}
      </View>

      <BottomSheet
        visible={open}
        onDismiss={() => setOpen(false)}
        title={t("hospitalWalkIns.checkInSheetTitle")}
      >
        <WalkInForm onDone={() => setOpen(false)} />
      </BottomSheet>
    </Screen>
  );
}

function WalkInRow({ walkIn }: { walkIn: any }) {
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const update = useUpdateWalkIn();
  const toast = useToast();

  const statusKey = `status.${walkIn.status}`;
  const statusLabel = t(statusKey, { defaultValue: walkIn.status.replace(/_/g, " ") });

  const tone =
    walkIn.priority === "urgent"
      ? "danger"
      : walkIn.status === "in_consultation"
        ? "warning"
        : walkIn.status === "completed"
          ? "success"
          : "primary";

  async function setStatus(s: any) {
    try {
      await update.mutateAsync({ id: walkIn.id, status: s });
      toast.show(t("hospitalWalkIns.statusUpdated", { status: s.replace("_", " ") }), "info");
    } catch (err: any) {
      toast.show(err?.message || t("hospitalWalkIns.updateError"), "danger");
    }
  }

  const doctorShort =
    walkIn.doctorName?.split(" ").slice(-1)[0] || "";
  const doctorDisplay = doctorShort
    ? `${t("hospitalWalkIns.doctorPrefix")}${doctorShort}`
    : "";

  return (
    <Card padded={false}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <Avatar name={walkIn.patientName} size="md" tone="primary" />
          <View style={{ flex: 1 }}>
            <Text style={[typography.title.sm, { color: colors.text }]}>
              {walkIn.patientName || t("hospitalWalkIns.fallbackPatient")}
            </Text>
            <Text
              style={[typography.body.sm, { color: colors.textMuted, marginTop: 2 }]}
              numberOfLines={1}
            >
              {walkIn.reason || t("hospitalWalkIns.noReason")}
              {doctorDisplay ? ` · ${doctorDisplay}` : ""}
            </Text>
          </View>
          <PillCmp label={statusLabel} tone={tone as any} size="sm" />
        </View>
        {walkIn.notes ? (
          <Text style={[typography.caption, { color: colors.textSubtle }]}>
            {walkIn.notes}
          </Text>
        ) : null}
        <View
          style={{ flexDirection: "row", gap: spacing.sm, flexWrap: "wrap" }}
        >
          {walkIn.status === "waiting" ? (
            <Button
              title={t("hospitalWalkIns.startConsult")}
              icon={CalendarClock}
              size="sm"
              variant="primary"
              fullWidth={false}
              onPress={() => setStatus("in_consultation")}
            />
          ) : null}
          {walkIn.status === "in_consultation" ? (
            <Button
              title={t("hospitalWalkIns.complete")}
              size="sm"
              variant="primary"
              fullWidth={false}
              onPress={() => setStatus("completed")}
            />
          ) : null}
          {walkIn.status !== "completed" && walkIn.status !== "no_show" ? (
            <Button
              title={t("hospitalWalkIns.noShow")}
              size="sm"
              variant="ghost"
              fullWidth={false}
              onPress={() => setStatus("no_show")}
            />
          ) : null}
        </View>
      </View>
    </Card>
  );
}

function WalkInForm({ onDone }: { onDone: () => void }) {
  const { spacing, colors, typography } = useTheme();
  const { t } = useTranslation();
  const toast = useToast();
  const create = useCreateWalkIn();

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");

  const { data: pdata } = useWalkInSearch(q);
  const patients: any[] = pdata?.patients || [];

  const { data: ddata } = useDoctorSearch({});
  const doctors: any[] = (ddata as any)?.doctors || [];

  async function submit() {
    if (!selected?.id || !doctorId) {
      toast.show(t("hospitalWalkIns.pickBoth"), "warning");
      return;
    }
    try {
      await create.mutateAsync({
        patientId: selected.id,
        doctorId,
        reason: reason || undefined,
        priority,
      });
      toast.show(t("hospitalWalkIns.checkedInToast"), "success");
      onDone();
    } catch (err: any) {
      toast.show(err?.message || t("hospitalWalkIns.checkedInError"), "danger");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <FormField label={t("hospitalWalkIns.patientLabel")}>
          <TextInput
            value={selected?.name || q}
            onChangeText={(v) => {
              setSelected(null);
              setQ(v);
            }}
            placeholder={t("hospitalWalkIns.patientSearchPlaceholder")}
          />
        </FormField>

        {q.length >= 2 && !selected ? (
          <Card padded={false}>
            <View style={{ maxHeight: 200 }}>
              {patients.length === 0 ? (
                <Text style={[typography.body.sm, { color: colors.textMuted, padding: spacing.md }]}>
                  {t("hospitalWalkIns.noMatches")}
                </Text>
              ) : (
                patients.map((p: any) => (
                  <Pressable
                    key={p.id}
                    onPress={() => {
                      setSelected(p);
                      setQ(p.name);
                    }}
                    style={({ pressed }) => ({
                      padding: spacing.md,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                      opacity: pressed ? 0.6 : 1,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    })}
                  >
                    <Avatar name={p.name} size="sm" />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body.md, { color: colors.text }]}>
                        {p.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {[p.phone, p.nic].filter(Boolean).join(" · ")}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={colors.textSubtle} />
                  </Pressable>
                ))
              )}
            </View>
          </Card>
        ) : null}

        <FormField label={t("hospitalWalkIns.doctorLabel")}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.xs }}>
              {doctors.map((d: any) => (
                <Pressable
                  key={d.id}
                  onPress={() => setDoctorId(d.id)}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: 20,
                    backgroundColor:
                      doctorId === d.id ? colors.primary : colors.surfaceMuted,
                  }}
                >
                  <Text
                    style={[
                      typography.label.md,
                      {
                        color:
                          doctorId === d.id ? "#fff" : colors.text,
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {d.name?.split(" ").slice(-1)[0] || d.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </FormField>

        <FormField label={t("hospitalWalkIns.reasonLabel")}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder={t("hospitalWalkIns.reasonPlaceholder")}
            multiline
          />
        </FormField>

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          {(["routine", "urgent"] as const).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPriority(p)}
              style={{
                flex: 1,
                paddingVertical: spacing.sm,
                borderRadius: 16,
                alignItems: "center",
                backgroundColor:
                  priority === p
                    ? p === "urgent"
                      ? colors.danger
                      : colors.primary
                    : colors.surfaceMuted,
              }}
            >
              <Text
                style={{
                  color: priority === p ? "#fff" : colors.text,
                  fontWeight: "700",
                }}
              >
                {p === "urgent"
                  ? t("hospitalWalkIns.priorityUrgent")
                  : t("hospitalWalkIns.priorityRoutine")}
              </Text>
            </Pressable>
          ))}
        </View>

        <Button
          title={t("hospitalWalkIns.checkInBtn")}
          icon={Plus}
          onPress={submit}
          loading={create.isPending}
          size="lg"
        />
      </View>
    </KeyboardAvoidingView>
  );
}