// @ts-nocheck
import { useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
} from "react-native";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Pill,
  Plus,
  Stethoscope,
  Trash2,
} from "lucide-react-native";
import {
  useDoctorRxTemplates,
  useDeleteRxTemplate,
} from "@/hooks/useApi";
import { Screen, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export default function RxTemplatesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography, radius, fontFamily } = useTheme();
  const { data, isLoading, isError, refetch, isRefetching } = useDoctorRxTemplates();
  const deleteMutation = useDeleteRxTemplate();

  const handleDelete = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        t("rxTemplates.deleteTitle"),
        t("rxTemplates.deleteMessage", { name }),
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.delete"),
            style: "destructive",
            onPress: () => deleteMutation.mutate(id),
          },
        ]
      );
    },
    [deleteMutation, t]
  );

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
      const meds = Array.isArray(item.medicines) ? item.medicines : [];
      const preview = meds
        .slice(0, 3)
        .map((m: any) => m.name)
        .filter(Boolean)
        .join(", ");
      return (
        <Pressable
          onPress={() => router.push(`/(doctor)/rx-templates/${item.id}` as any)}
          style={({ pressed }) => ({
            flexDirection: "row",
            alignItems: "center",
            padding: spacing.md,
            marginHorizontal: spacing.lg,
            marginBottom: spacing.sm,
            borderRadius: radius.md,
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              backgroundColor: colors.primarySoft,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing.md,
            }}
          >
            <Pill size={20} color={colors.primary} strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                fontSize: 15,
                fontWeight: "700",
                color: colors.text,
                fontFamily: fontFamily.bodyBold,
              }}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            {item.diagnosis && (
              <Text
                style={{ fontSize: 12, color: colors.textSubtle, marginTop: 2 }}
                numberOfLines={1}
              >
                {item.diagnosis}
              </Text>
            )}
            <Text
              style={{ fontSize: 11, color: colors.textSubtle, marginTop: 2 }}
              numberOfLines={1}
            >
              {preview || t("rxTemplates.noMeds")}
              {meds.length > 3 ? ` · +${meds.length - 3}` : ""}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: radius.full,
                backgroundColor: colors.primarySoft,
                marginBottom: 6,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "800",
                  color: colors.primary,
                  fontFamily: fontFamily.displayBold,
                }}
              >
                ×{item.useCount}
              </Text>
            </View>
            <Pressable
              onPress={() => handleDelete(item.id, item.name)}
              hitSlop={6}
              style={({ pressed }) => ({
                padding: 6,
                borderRadius: 8,
                backgroundColor: pressed ? colors.dangerSoft : "transparent",
              })}
            >
              <Trash2 size={16} color={colors.danger} strokeWidth={1.8} />
            </Pressable>
          </View>
        </Pressable>
      );
    },
    [colors, spacing, typography, fontFamily, radius, router, t, handleDelete]
  );

  return (
    <Screen padded={false} scroll={false} edges={["top"]} style={{ backgroundColor: colors.bg }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
          paddingBottom: spacing.md,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={[
              typography.display.lg,
              {
                color: colors.text,
                fontFamily: fontFamily.displayBold,
                fontSize: 28,
                lineHeight: 34,
              },
            ]}
          >
            {t("rxTemplates.title")}
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSubtle, marginTop: 4 },
            ]}
          >
            {t("rxTemplates.subtitle")}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push("/(doctor)/rx-templates/new" as any)}
          style={({ pressed }) => ({
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderRadius: radius.full,
            backgroundColor: pressed ? colors.primary : colors.primary,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
          <Text
            style={{
              color: "#FFFFFF",
              fontWeight: "700",
              fontSize: 13,
              fontFamily: fontFamily.bodyBold,
            }}
          >
            {t("rxTemplates.newCta")}
          </Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={{
              flexDirection: "row", alignItems: "center",
              padding: spacing.md, marginBottom: spacing.sm,
              borderRadius: radius.md, backgroundColor: colors.surface,
              borderWidth: 1, borderColor: colors.border,
            }}>
              <Skeleton width={44} height={44} radius={14} style={{ marginRight: spacing.md }} />
              <View style={{ flex: 1 }}>
                <Skeleton width="60%" height={14} radius={4} style={{ marginBottom: 6 }} />
                <Skeleton width="40%" height={12} radius={4} />
              </View>
            </View>
          ))}
        </View>
      ) : isError ? (
        <ErrorState
          title={t("rxTemplates.errorTitle")}
          message={t("rxTemplates.errorBody")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : (data?.templates?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Stethoscope size={42} color={colors.primary} strokeWidth={1.6} />}
          title={t("rxTemplates.emptyTitle")}
          message={t("rxTemplates.emptyBody")}
          actionLabel={t("rxTemplates.newCta")}
          onAction={() => router.push("/(doctor)/rx-templates/new" as any)}
        />
      ) : (
        <FlatList
          data={data?.templates || []}
          keyExtractor={(t) => t.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingTop: spacing.sm, paddingBottom: 120 }}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} tintColor={colors.primary} />
          }
        />
      )}
    </Screen>
  );
}
