import React, { useState } from "react";
import { View, Text, Alert, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Ban,
  CheckCircle2,
  Trash2,
  Pencil,
  StickyNote,
  Send,
  UserCog,
} from "lucide-react-native";
import {
  Screen,
  Avatar,
  Button,
  BottomSheet,
  TextInput,
  ChipGroup,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useAdminUser,
  useAdminUserNotes,
  useSuspendUser,
  useUnsuspendUser,
  useDeleteUser,
  useUpdateUser,
  useAddUserNote,
  useDeleteUserNote,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  KV,
  ListSkeleton,
  AdminError,
  RolePill,
  StatusPill,
  roleLabel,
} from "@/components/admin/ui";
import { fmtDateTime } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";
import { useAuthStore } from "@/stores/auth";

const EDIT_ROLES = [
  { label: "Patient", value: "patient" },
  { label: "Doctor", value: "doctor" },
  { label: "Hospital admin", value: "hospital_admin" },
  { label: "Hospital staff", value: "hospital_staff" },
  { label: "Laboratory", value: "laboratory" },
  { label: "Pharmacy", value: "pharmacy" },
  { label: "Insurance", value: "insurance" },
  { label: "Ambulance", value: "ambulance" },
];

export default function AdminUserDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const toast = useToast();
  const me = useAuthStore((s) => s.user);

  const { data, isLoading, isError, refetch, isRefetching } = useAdminUser(id!);
  const { data: notes } = useAdminUserNotes(id!);

  const suspend = useSuspendUser(id!);
  const unsuspend = useUnsuspendUser(id!);
  const del = useDeleteUser(id!);
  const update = useUpdateUser(id!);
  const addNote = useAddUserNote(id!);
  const deleteNote = useDeleteUserNote();

  const [suspendSheet, setSuspendSheet] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [editSheet, setEditSheet] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");
  const [noteText, setNoteText] = useState("");

  const u = data?.user;
  const profiles = data?.profiles ?? {};
  const isSelf = me?.id === u?.id;
  const isSuspended = u?.status === "suspended";

  const openEdit = () => {
    setEditName(u?.name ?? "");
    setEditPhone(u?.phone ?? "");
    setEditRole(u?.role ?? "patient");
    setEditSheet(true);
  };

  const onSaveEdit = () => {
    update.mutate(
      {
        name: editName.trim() || undefined,
        phone: editPhone.trim() || null,
        role: editRole as any,
      },
      {
        onSuccess: () => {
          toast.show("User updated", "success");
          setEditSheet(false);
        },
        onError: (e: any) => toast.show(e?.message ?? "Update failed", "danger"),
      }
    );
  };

  const onSuspend = () => {
    if (suspendReason.trim().length < 3) return;
    suspend.mutate(suspendReason.trim(), {
      onSuccess: () => {
        toast.show("User suspended", "success");
        setSuspendSheet(false);
        setSuspendReason("");
      },
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
  };

  const onUnsuspend = () => {
    unsuspend.mutate(undefined, {
      onSuccess: () => toast.show("User reactivated", "success"),
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
  };

  const onDelete = () => {
    Alert.alert(
      "Delete user",
      `Permanently delete ${u?.name ?? "this user"}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            del.mutate(undefined, {
              onSuccess: () => {
                toast.show("User deleted", "success");
                router.back();
              },
              onError: (e: any) =>
                toast.show(e?.message ?? "Delete failed", "danger"),
            }),
        },
      ]
    );
  };

  const onAddNote = () => {
    if (!noteText.trim()) return;
    addNote.mutate(noteText.trim(), {
      onSuccess: () => {
        setNoteText("");
        toast.show("Note added", "success");
      },
      onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
    });
  };

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetch}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Account"
          title={u?.name ?? "User"}
          subtitle={u ? roleLabel(u.role) : undefined}
        >
          {u ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                marginTop: spacing.lg,
              }}
            >
              <View
                style={{
                  borderRadius: 999,
                  padding: 2,
                  backgroundColor: "rgba(255,255,255,0.28)",
                }}
              >
                <Avatar name={u.name ?? "?"} size="lg" />
              </View>
              <View
                style={{
                  flexDirection: "row",
                  gap: 6,
                  flexWrap: "wrap",
                  flex: 1,
                }}
              >
                <RolePill role={u.role} />
                <StatusPill status={u.status ?? "active"} />
                {u.verified ? <StatusPill status="verified" /> : null}
              </View>
            </View>
          ) : null}
        </AdminHero>
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xxl + 4,
          paddingBottom: spacing.xxxl,
          marginTop: spacing.xxl,
        }}
      >
        {isError ? <AdminError message="Couldn't load this user." /> : null}
        {isLoading ? (
          <ListSkeleton rows={5} />
        ) : u ? (
          <>
            {/* Contact & identity */}
            <View>
              <AdminSection title="Identity" />
              <AdminCard style={{ paddingVertical: spacing.sm }}>
                <KV label="Email" value={u.email} />
                <KV label="Phone" value={u.phone} />
                <KV label="NIC" value={u.nic} />
                <KV
                  label="Joined"
                  value={
                    u.createdAt ? fmtDateTime(u.createdAt, locale as any) : null
                  }
                />
                <KV
                  label="Last login"
                  value={
                    u.lastLoginAt
                      ? fmtDateTime(u.lastLoginAt, locale as any)
                      : null
                  }
                />
                {u.status === "suspended" && u.suspendedReason ? (
                  <KV label="Suspension reason" value={u.suspendedReason} />
                ) : null}
                {u.status === "rejected" && u.rejectionReason ? (
                  <KV label="Rejection reason" value={u.rejectionReason} />
                ) : null}
              </AdminCard>
            </View>

            {/* Role profile */}
            {profiles.doctor ? (
              <View>
                <AdminSection title="Doctor profile" />
                <AdminCard>
                  <KV
                    label="Specialization"
                    value={profiles.doctor.specialization}
                  />
                  <KV
                    label="SLMC no."
                    value={profiles.doctor.slmcRegistrationNo}
                  />
                  <KV
                    label="SLMC verified"
                    value={profiles.doctor.slmcVerifiedAt ? "Yes" : "No"}
                  />
                  <KV label="Rating" value={profiles.doctor.rating} />
                </AdminCard>
              </View>
            ) : null}
            {profiles.hospital ? (
              <View>
                <AdminSection title="Hospital" />
                <AdminCard>
                  <KV label="Name" value={profiles.hospital.name} />
                  <KV label="License" value={profiles.hospital.license} />
                  <KV label="Address" value={profiles.hospital.address} />
                </AdminCard>
              </View>
            ) : null}
            {profiles.clinic ? (
              <View>
                <AdminSection title="Clinic" />
                <AdminCard>
                  <KV label="Name" value={profiles.clinic.name} />
                  <KV label="License" value={profiles.clinic.license} />
                </AdminCard>
              </View>
            ) : null}
            {profiles.lab ? (
              <View>
                <AdminSection title="Laboratory" />
                <AdminCard>
                  <KV
                    label="License"
                    value={
                      profiles.lab.licenseNumber ?? profiles.lab.license_number
                    }
                  />
                  <KV label="City" value={profiles.lab.city} />
                </AdminCard>
              </View>
            ) : null}

            {/* Actions */}
            <View>
              <AdminSection title="Account actions" />
              <AdminCard>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Edit"
                      size="sm"
                      variant="outline"
                      icon={Pencil}
                      onPress={openEdit}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    {isSuspended ? (
                      <Button
                        title="Reactivate"
                        size="sm"
                        icon={CheckCircle2}
                        onPress={onUnsuspend}
                        loading={unsuspend.isPending}
                      />
                    ) : (
                      <Button
                        title="Suspend"
                        size="sm"
                        variant="danger"
                        icon={Ban}
                        onPress={() => setSuspendSheet(true)}
                        disabled={isSelf}
                      />
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Delete"
                      size="sm"
                      variant="ghost"
                      icon={Trash2}
                      onPress={onDelete}
                      disabled={isSelf}
                    />
                  </View>
                </View>
                {u?.role !== "super_admin" && !isSelf ? (
                  <View style={{ marginTop: spacing.sm }}>
                    <Button
                      title="Impersonate (web, 15 min)"
                      size="sm"
                      variant="secondary"
                      icon={UserCog}
                      onPress={() =>
                        router.push({
                          pathname: "/(admin)/impersonate",
                          params: { userId: u!.id },
                        } as any)
                      }
                    />
                  </View>
                ) : null}
              </AdminCard>
            </View>

            {/* Admin notes */}
            <View>
              <AdminSection
                title="Admin notes"
                count={notes?.items?.length ?? 0}
              />
              <AdminCard style={{ padding: 0 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    padding: spacing.md,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <TextInput
                      value={noteText}
                      onChangeText={setNoteText}
                      placeholder="Add an internal note…"
                      leadingIcon={StickyNote}
                      tone="soft"
                    />
                  </View>
                  <Button
                    title="Add"
                    size="sm"
                    variant="secondary"
                    fullWidth={false}
                    icon={Send}
                    onPress={onAddNote}
                    loading={addNote.isPending}
                    disabled={!noteText.trim()}
                  />
                </View>
                {(notes?.items ?? []).map((n: any, i: number) => (
                  <View
                    key={n.id}
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={[
                          typography.label.sm,
                          { color: colors.textSubtle, flexShrink: 1 },
                        ]}
                      >
                        {n.adminName ?? "Admin"} ·{" "}
                        {n.createdAt
                          ? fmtDateTime(n.createdAt, locale as any)
                          : ""}
                      </Text>
                      {n.adminUserId === me?.id ? (
                        <Button
                          title="Delete"
                          size="sm"
                          variant="ghost"
                          fullWidth={false}
                          onPress={() =>
                            deleteNote.mutate(n.id, {
                              onError: (e: any) =>
                                toast.show(e?.message ?? "Failed", "danger"),
                            })
                          }
                        />
                      ) : null}
                    </View>
                    <Text
                      style={[
                        typography.body.md,
                        { color: colors.text, marginTop: 4 },
                      ]}
                    >
                      {n.body}
                    </Text>
                  </View>
                ))}
                {(notes?.items ?? []).length === 0 ? (
                  <View
                    style={{
                      padding: spacing.xl,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.separator,
                    }}
                  >
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textSubtle, textAlign: "center" },
                      ]}
                    >
                      No notes yet
                    </Text>
                  </View>
                ) : null}
              </AdminCard>
            </View>
          </>
        ) : null}
      </View>

      {/* Suspend sheet */}
      <BottomSheet
        visible={suspendSheet}
        onDismiss={() => setSuspendSheet(false)}
        title="Suspend account"
      >
        <Text
          style={[
            typography.body.sm,
            { color: colors.textMuted, marginBottom: spacing.md },
          ]}
        >
          {u?.name ?? "This user"} won't be able to sign in until reactivated.
        </Text>
        <TextInput
          value={suspendReason}
          onChangeText={setSuspendReason}
          placeholder="Reason (required)"
          multiline
          numberOfLines={3}
          style={{ minHeight: 88, textAlignVertical: "top" }}
        />
        <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
          <Button
            title="Suspend account"
            variant="danger"
            onPress={onSuspend}
            loading={suspend.isPending}
            disabled={suspendReason.trim().length < 3}
          />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => setSuspendSheet(false)}
          />
        </View>
      </BottomSheet>

      {/* Edit sheet */}
      <BottomSheet
        visible={editSheet}
        onDismiss={() => setEditSheet(false)}
        title="Edit user"
        height={520}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: spacing.md }}>
            <View>
              <FieldLabel>Name</FieldLabel>
              <TextInput value={editName} onChangeText={setEditName} />
            </View>
            <View>
              <FieldLabel>Phone</FieldLabel>
              <TextInput
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
              />
            </View>
            <View>
              <FieldLabel>Role</FieldLabel>
              <ChipGroup
                options={EDIT_ROLES}
                value={editRole}
                onChange={(v: string) => setEditRole(v)}
              />
            </View>
            <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
              <Button
                title="Save changes"
                onPress={onSaveEdit}
                loading={update.isPending}
              />
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setEditSheet(false)}
              />
            </View>
          </View>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

function FieldLabel({ children }: { children: string }) {
  const { colors, typography } = useTheme();
  return (
    <Text
      style={[
        typography.label.md,
        {
          color: colors.textMuted,
          marginBottom: 8,
          marginLeft: 2,
        },
      ]}
    >
      {children}
    </Text>
  );
}
