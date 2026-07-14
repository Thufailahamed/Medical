// @ts-nocheck
// Caretaker Profiles: real profile screen for a caretaker. Shows the
// caretaker's own identity + a "Managing" section listing every
// principal they currently have an active link to. Tapping a principal
// row flips the active-principal context (header + Zustand store + server
// durable column) and lands the user on that principal's home.
//
// The screen is the caretaker's only "settings" entry point — they have
// no patient row to edit, so account / app / sign-out rows live here.

import { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  KeyRound,
  Lock,
  Palette,
  HelpCircle,
  LogOut,
  Users,
  ChevronRight,
  ShieldUser,
  Check,
} from "lucide-react-native";
import { useAuthStore } from "@/stores/auth";
import { useTheme } from "@/theme/ThemeProvider";
import {
  useMyPrincipals,
  useSetActivePrincipal,
} from "@/hooks/useCaretaker";
import { useActivePrincipalStore } from "@/stores/activePrincipal";
import { api } from "@/lib/api";
import {
  Screen,
  Card,
  Avatar,
  Pill,
  Skeleton,
  Button,
  IconButton,
  SectionHeader,
  Divider,
  ListItem,
} from "@/components/ui";

export default function CaretakerProfile() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const { user, logout } = useAuthStore();
  const queryClient = useQueryClient();

  const { data, isLoading } = useMyPrincipals();
  const activeId = useActivePrincipalStore((s) => s.activePrincipalPatientId);
  const setActive = useActivePrincipalStore(
    (s) => s.setActivePrincipalPatientId
  );
  const clear = useActivePrincipalStore((s) => s.clear);
  const setServer = useSetActivePrincipal();

  const principals = data?.principals ?? [];
  const activePrincipal = useMemo(
    () => principals.find((p) => p.patientId === activeId) ?? null,
    [principals, activeId]
  );

  async function pick(patientId: string) {
    setActive(patientId);
    try {
      await setServer.mutateAsync(patientId);
    } catch {
      // ignore — next request revalidates against the server column
    }
    queryClient.invalidateQueries();
    router.replace("/(app)/index" as any);
  }

  async function unmanage() {
    clear();
    try {
      await setServer.mutateAsync(null);
    } catch {
      // ignore
    }
    queryClient.invalidateQueries();
    router.replace("/(caretaker)/index" as any);
  }

  function confirmLogout() {
    Alert.alert(
      t("profile.logout.title"),
      t("profile.logout.body"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("profile.logout.confirm"),
          style: "destructive",
          onPress: handleLogout,
        },
      ]
    );
  }

  async function handleLogout() {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    queryClient.clear();
    logout();
    router.replace("/(auth)/login" as any);
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing.xxxxl }}
      >
        {/* ─── Top bar ─── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
          }}
        >
          <Text
            style={[
              typography.display.sm,
              {
                color: colors.text,
                fontWeight: "800",
                letterSpacing: -0.5,
              },
            ]}
          >
            {t("profile.title")}
          </Text>
          <IconButton
            icon={Bell}
            variant="ghost"
            size="md"
            onPress={() => router.push("/(app)/notifications" as any)}
            accessibilityLabel={t("profile.item.notifications.label")}
          />
        </View>

        {/* ─── Hero identity card ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xs,
          }}
        >
          <Card padded={false}>
            <View
              style={{
                padding: spacing.xl,
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.lg,
              }}
            >
              <Avatar
                name={user?.name}
                source={user?.photo ? { uri: user.photo } : undefined}
                size="2xl"
                ring
                tone="info"
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={[
                    typography.title.lg,
                    {
                      color: colors.text,
                      fontWeight: "800",
                      letterSpacing: -0.4,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {user?.name || "—"}
                </Text>
                <Text
                  style={[
                    typography.body.sm,
                    { color: colors.textMuted, marginTop: 2 },
                  ]}
                  numberOfLines={1}
                >
                  {user?.email || user?.phone || ""}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.xs,
                    marginTop: spacing.sm,
                    flexWrap: "wrap",
                  }}
                >
                  <Pill
                    icon={ShieldUser}
                    label={t("caretaker.profile.rolePill")}
                    tone="info"
                    size="sm"
                  />
                  {activePrincipal ? (
                    <Pill
                      icon={Users}
                      label={t("caretaker.profile.actingAs", {
                        name: activePrincipal.principalName,
                      })}
                      tone="primary"
                      size="sm"
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* ─── Managing section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("caretaker.profile.section.managing")}
            style={{ paddingHorizontal: spacing.lg }}
          />
          <View style={{ marginHorizontal: spacing.lg, gap: spacing.sm }}>
            {isLoading ? (
              <Card>
                <Skeleton width="80%" height={18} />
                <Skeleton width="60%" height={14} style={{ marginTop: 8 }} />
              </Card>
            ) : principals.length === 0 ? (
              <Card>
                <Text
                  style={{
                    ...typography.body,
                    color: colors.textMuted,
                  }}
                >
                  {t("caretaker.profile.empty")}
                </Text>
              </Card>
            ) : (
              principals.map((p) => {
                const isActive = p.patientId === activeId;
                return (
                  <Card
                    key={p.patientId}
                    padded={false}
                    onPress={() => pick(p.patientId)}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      "caretaker.profile.switchPrincipal",
                      { name: p.principalName }
                    )}
                  >
                    <View
                      style={{
                        padding: spacing.lg,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: spacing.md,
                      }}
                    >
                      <Avatar
                        uri={p.principalPhoto ?? undefined}
                        name={p.principalName}
                        size="md"
                      />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text
                          style={[
                            typography.title.sm,
                            {
                              color: colors.text,
                              fontWeight: "700",
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {p.principalName}
                        </Text>
                        <Text
                          style={[
                            typography.caption,
                            {
                              color: colors.textSecondary,
                              marginTop: 2,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {t(`caretaker.role.${p.careRole}`)}
                          {p.principalPhone ? ` · ${p.principalPhone}` : ""}
                        </Text>
                      </View>
                      {isActive ? (
                        <Pill
                          icon={Check}
                          label={t("caretaker.profile.active")}
                          tone="success"
                          size="sm"
                        />
                      ) : (
                        <ChevronRight
                          size={18}
                          color={colors.textSubtle}
                          strokeWidth={2.25}
                        />
                      )}
                    </View>
                  </Card>
                );
              })
            )}
            {activePrincipal ? (
              <Button
                title={t("caretaker.profile.unmanage")}
                variant="ghost"
                onPress={unmanage}
                fullWidth
              />
            ) : null}
          </View>
        </View>

        {/* ─── Account section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("profile.section.account")}
            style={{ paddingHorizontal: spacing.lg }}
          />
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              <ListItem
                icon={KeyRound}
                iconTone="neutral"
                title={t("profile.item.changePassword.label")}
                subtitle={t("profile.item.changePassword.subtitle")}
                onPress={() => router.push("/(app)/change-password" as any)}
                showChevron
                bordered={false}
              />
              <Divider />
              <ListItem
                icon={Lock}
                iconTone="primary"
                title={t("profile.item.appLock.label")}
                subtitle={t("profile.item.appLock.subtitle")}
                onPress={() => router.push("/(app)/app-lock" as any)}
                showChevron
                bordered={false}
              />
              <Divider />
              <ListItem
                icon={Palette}
                iconTone="primary"
                title={t("profile.item.appearance.label")}
                subtitle={t("profile.item.appearance.subtitle")}
                onPress={() => router.push("/(app)/appearance" as any)}
                showChevron
                bordered={false}
              />
              <Divider />
              <ListItem
                icon={Bell}
                iconTone="warning"
                title={t("profile.item.notificationPreferences.label")}
                subtitle={t("profile.item.notificationPreferences.subtitle")}
                onPress={() =>
                  router.push("/(app)/notification-preferences" as any)
                }
                showChevron
                bordered={false}
              />
            </Card>
          </View>
        </View>

        {/* ─── Support section ─── */}
        <View style={{ marginTop: spacing.lg }}>
          <SectionHeader
            title={t("profile.section.support")}
            style={{ paddingHorizontal: spacing.lg }}
          />
          <View style={{ marginHorizontal: spacing.lg }}>
            <Card padded={false}>
              <ListItem
                icon={HelpCircle}
                iconTone="neutral"
                title={t("profile.item.helpSupport.label")}
                subtitle={t("profile.item.helpSupport.subtitle")}
                onPress={() => router.push("/(app)/support" as any)}
                showChevron
                bordered={false}
              />
            </Card>
          </View>
        </View>

        {/* ─── Sign out ─── */}
        <View
          style={{
            marginHorizontal: spacing.lg,
            marginTop: spacing.xxl,
            gap: spacing.lg,
            alignItems: "center",
          }}
        >
          <Button
            title={t("profile.logout.confirm")}
            variant="outline"
            icon={LogOut}
            onPress={confirmLogout}
            fullWidth
          />
          <Text
            style={[
              typography.caption,
              { color: colors.textSubtle, textAlign: "center" },
            ]}
          >
            {t("profile.footer")}
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}
