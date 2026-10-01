// @ts-nocheck
// Phlebotomist roster: list + add.

import { useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import { Users, Plus, Phone } from "lucide-react-native";
import { useLabPhlebotomists, useLabAddPhlebotomist } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  TextInput,
  BottomSheet,
  FormField,
  useToast,
  IconTile,
} from "@/components/ui";

export default function LabTeamScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const roster = useLabPhlebotomists();
  const add = useLabAddPhlebotomist();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const rows: any[] = roster.data?.phlebotomists ?? [];

  async function onAdd() {
    if (!name.trim() || !phone.trim()) {
      toast.show(t("common.error"), "danger");
      return;
    }
    try {
      await add.mutateAsync({ name: name.trim(), phone: phone.trim(), email: email.trim() || undefined });
      setSheetOpen(false);
      setName("");
      setPhone("");
      setEmail("");
      toast.show(t("lab.saved"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("lab.teamTitle")}
        subtitle={t("lab.teamSubtitle")}
        kicker="LABORATORY"
        right={
          <Button title={t("lab.addMember")} icon={Plus} size="sm" onPress={() => setSheetOpen(true)} />
        }
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={roster.isFetching && !roster.isLoading}
            onRefresh={() => roster.refetch()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {roster.isLoading ? (
          <Skeleton height={120} radius={20} />
        ) : roster.isError ? (
          <ErrorState onRetry={() => roster.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("lab.empty")}
            actionLabel={t("lab.addMember")}
            onAction={() => setSheetOpen(true)}
          />
        ) : (
          rows.map((p: any, i: number) => (
            <Card key={p.id ?? i} style={{ padding: spacing.md }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile icon={Users} tone={p.isActive === false ? "neutral" : "primary"} />
                <View style={{ flex: 1 }}>
                  <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    <Phone size={12} /> {p.phone}
                    {p.isActive === false ? " · inactive" : ""}
                  </Text>
                </View>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <BottomSheet visible={sheetOpen} onDismiss={() => setSheetOpen(false)} title={t("lab.addMember")}>
        <View style={{ gap: spacing.md }}>
          <FormField label={t("lab.name")}>
            <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label={t("lab.phone")}>
            <TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label={t("lab.email")}>
            <TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholderTextColor={colors.textSubtle} />
          </FormField>
          <Button title={t("lab.save")} icon={Plus} size="lg" onPress={onAdd} loading={add.isPending} disabled={add.isPending} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
