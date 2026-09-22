// @ts-nocheck
// Doctor "New conversation" — pick a patient to open (or resume) the
// 1:1 thread. Search hits /doctor/search-patients (scoped to patients
// the doctor has a relationship with); the default list shows the
// doctor's most-recently-visited patients.

import { useState, useCallback } from "react";
import { View, Text, ScrollView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Search, ChevronRight, UserRound } from "lucide-react-native";
import {
  useSearchPatients,
  useRecentDoctorPatients,
  useStartConversation,
} from "@/hooks/useApi";
import { useDebounce } from "@/hooks/useDebounce";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  TextInput,
  ListItem,
  Avatar,
  Skeleton,
  EmptyState,
  ErrorState,
  useToast,
} from "@/components/ui";

export default function NewConversationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors, spacing, typography } = useTheme();

  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 300);
  const searching = debounced.trim().length >= 2;

  const search = useSearchPatients(debounced.trim());
  const recent = useRecentDoctorPatients(10);
  const startConversation = useStartConversation();
  const toast = useToast();

  const list = searching
    ? search.data?.patients || []
    : recent.data?.patients || [];
  const isLoading = searching ? search.isLoading : recent.isLoading;
  const isError = searching ? search.isError : recent.isError;
  const refetch = searching ? search.refetch : recent.refetch;

  const handlePick = useCallback(
    async (patientId: string) => {
      if (!patientId || startConversation.isPending) return;
      try {
        const res = await startConversation.mutateAsync(patientId);
        const convId = res?.conversation?.id;
        if (convId) {
          router.replace(`/(doctor)/inbox/${convId}` as any);
        }
      } catch {
        toast.show(t("inbox.startFailed"), "error");
      }
    },
    [startConversation, router, toast, t]
  );

  const renderRow = (p: any) => {
    const pId = p.patient?.id || p.patients?.id || p.id;
    const pName = p.user?.name || p.users?.name || p.name;
    const pPhone = p.user?.phone || p.users?.phone || p.phone;
    const pNic = p.patient?.nic || p.patients?.nic;
    const pPhoto = p.user?.photo || p.users?.photo || p.photo;
    return (
      <ListItem
        key={pId}
        variant="contact"
        iconTone="primary"
        title={pName || t("inbox.patientFallback")}
        subtitle={pPhone || pNic || t("inbox.tapToMessage")}
        mediaSlot={
          <Avatar
            name={pName}
            size="md"
            tone="primary"
            source={pPhoto ? { uri: pPhoto } : undefined}
          />
        }
        trailing={
          startConversation.isPending ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
              }}
            >
              <ChevronRight size={18} color={colors.onPrimary} strokeWidth={2.5} />
            </View>
          )
        }
        onPress={() => handlePick(pId)}
      />
    );
  };

  return (
    <Screen scroll={false} padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title={t("inbox.newTitle")}
        subtitle={t("inbox.newSubtitle")}
      />

      <View style={{ flex: 1, padding: spacing.lg, gap: spacing.lg }}>
        <TextInput
          placeholder={t("inbox.searchPlaceholder")}
          value={query}
          onChangeText={setQuery}
          leadingIcon={Search}
          tone="soft"
          autoCapitalize="none"
        />

        {isLoading ? (
          <View style={{ gap: spacing.sm }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} height={64} radius={14} />
            ))}
          </View>
        ) : isError ? (
          <ErrorState
            title={t("inbox.errorTitle")}
            message={t("inbox.errorBody")}
            actionLabel={t("common.retry")}
            onAction={() => refetch()}
          />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<UserRound size={42} color={colors.primary} strokeWidth={1.6} />}
            title={
              searching
                ? t("inbox.noPatientsFound")
                : t("inbox.noRecentPatients")
            }
            message={
              searching
                ? t("inbox.noPatientsFoundBody")
                : t("inbox.noRecentPatientsBody")
            }
          />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ gap: spacing.sm, paddingBottom: 100 }}
          >
            {!searching && (
              <Text
                style={[
                  typography.label.sm,
                  { color: colors.textMuted, textTransform: "uppercase" },
                ]}
              >
                {t("inbox.recentPatients")}
              </Text>
            )}
            {list.map(renderRow)}
          </ScrollView>
        )}
      </View>
    </Screen>
  );
}
