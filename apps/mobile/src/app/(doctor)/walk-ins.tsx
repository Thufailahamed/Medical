// @ts-nocheck
// Doctor walk-in queue: same-day arrivals without appointments.
// Mirrors web `portal/(portal)/walk-ins`.

import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  UserPlus,
  Clock,
  Play,
  CheckCircle2,
  Phone,
  Search,
} from "lucide-react-native";
import {
  useWalkIns,
  useCreateWalkIn,
  useUpdateWalkIn,
  useWalkInSearch,
} from "@/hooks/useApi";
import { useAuthStore } from "@/stores/auth";
import { useLocaleStore } from "@/stores/locale";
import { useTheme } from "@/theme/ThemeProvider";
import { fmtTime } from "@/lib/format";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  TextInput,
  FormField,
  BottomSheet,
  EmptyState,
  ErrorState,
  Skeleton,
  useToast,
  Divider,
  IconTile,
} from "@/components/ui";

const FILTERS = ["waiting", "in_consultation", "completed", "no_show", "all"] as const;

export default function WalkInsScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const user = useAuthStore((s) => s.user);
  const locale = useLocaleStore((s) => s.locale);

  const [filter, setFilter] = useState<string>("waiting");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState<"routine" | "urgent">("routine");

  const list = useWalkIns({ status: filter === "all" ? undefined : filter });
  const create = useCreateWalkIn();
  const update = useUpdateWalkIn();
  const search = useWalkInSearch(query.trim());

  const walkIns = useMemo(() => list.data?.walkIns ?? [], [list.data?.walkIns]);
  const results = useMemo(() => search.data?.patients ?? [], [search.data?.patients]);

  async function onRegister() {
    if (!selectedPatient) {
      toast.show(t("walkIns.selectPatient"), "danger");
      return;
    }
    if (!user?.id) {
      toast.show(t("common.error"), "danger");
      return;
    }
    try {
      await create.mutateAsync({
        patientId: selectedPatient.id,
        doctorId: user.id,
        reason: reason.trim() || undefined,
        priority,
      });
      setSheetOpen(false);
      setQuery("");
      setSelectedPatient(null);
      setReason("");
      setPriority("routine");
      toast.show(t("walkIns.registered"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  async function onStatus(id: string, status: "waiting" | "in_consultation" | "completed" | "no_show") {
    try {
      await update.mutateAsync({ id, status });
    } catch (e: any) {
      Alert.alert(t("common.error"), e?.message || t("common.error"));
    }
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("walkIns.title")}
        subtitle={t("walkIns.subtitle")}
        kicker="FRONT DESK"
        back={true}
        onBack={() => router.back()}
        right={
          <Button
            title={t("walkIns.register")}
            icon={UserPlus}
            size="sm"
            onPress={() => setSheetOpen(true)}
          />
        }
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm }}>
        {FILTERS.map((f) => (
          <Chip
            key={f}
            label={t(`walkIns.statuses.${f}`)}
            selected={filter === f}
            onPress={() => setFilter(f)}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.md,
        }}
        refreshControl={
          <RefreshControl
            refreshing={list.isFetching && !list.isLoading}
            onRefresh={() => list.refetch()}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {list.isLoading ? (
          <Skeleton height={120} radius={20} />
        ) : list.isError ? (
          <ErrorState onRetry={() => list.refetch()} />
        ) : walkIns.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={t("walkIns.empty")}
            actionLabel={t("walkIns.register")}
            onAction={() => setSheetOpen(true)}
          />
        ) : (
          walkIns.map((w: any, idx: number) => (
            <Card key={w.id ?? idx} style={{ padding: spacing.lg, gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <IconTile
                  icon={w.status === "completed" ? CheckCircle2 : w.status === "in_consultation" ? Play : Clock}
                  tone={w.status === "completed" ? "success" : w.status === "in_consultation" ? "warning" : "primary"}
                />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                    {w.patientName ?? t("walkIns.unknownPatient")}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
                    {w.reason || t(`walkIns.statuses.${w.status}`, { defaultValue: w.status })}
                    {w.arrivedAt ? ` · ${fmtTime(new Date(w.arrivedAt), locale)}` : ""}
                  </Text>
                </View>
                {w.priority === "urgent" ? (
                  <Chip label={t("walkIns.urgent")} tone="danger" />
                ) : null}
              </View>
              {w.patientPhone ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  <Phone size={12} /> {w.patientPhone}
                </Text>
              ) : null}
              {w.status === "waiting" ? (
                <Button
                  title={t("walkIns.start")}
                  icon={Play}
                  onPress={() => onStatus(w.id, "in_consultation")}
                  loading={update.isPending}
                  disabled={update.isPending}
                />
              ) : null}
              {w.status === "in_consultation" ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("walkIns.complete")}
                      icon={CheckCircle2}
                      onPress={() => onStatus(w.id, "completed")}
                      loading={update.isPending}
                      disabled={update.isPending}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title={t("walkIns.markNoShow")}
                      variant="secondary"
                      onPress={() => onStatus(w.id, "no_show")}
                      loading={update.isPending}
                      disabled={update.isPending}
                    />
                  </View>
                </View>
              ) : null}
            </Card>
          ))
        )}
      </ScrollView>

      {/* ── Register walk-in sheet ── */}
      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        title={t("walkIns.register")}
      >
        <View style={{ gap: spacing.md }}>
          <FormField label={t("walkIns.searchPatient")}>
            <TextInput
              value={query}
              onChangeText={(v: string) => {
                setQuery(v);
                setSelectedPatient(null);
              }}
              placeholder={t("walkIns.searchPlaceholder")}
              placeholderTextColor={colors.textSubtle}
            />
          </FormField>

          {query.trim().length >= 2 && !selectedPatient ? (
            <View style={{ gap: spacing.xs }}>
              {search.isLoading ? (
                <Skeleton height={48} radius={12} />
              ) : results.length === 0 ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {t("walkIns.noResults")}
                </Text>
              ) : (
                results.slice(0, 6).map((p: any) => (
                  <Button
                    key={p.id}
                    title={`${p.name}${p.phone ? ` · ${p.phone}` : ""}`}
                    variant="secondary"
                    onPress={() => setSelectedPatient(p)}
                  />
                ))
              )}
            </View>
          ) : null}

          {selectedPatient ? (
            <Card style={{ padding: spacing.md }}>
              <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]}>
                {selectedPatient.name}
              </Text>
              {selectedPatient.phone ? (
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {selectedPatient.phone}
                </Text>
              ) : null}
              <Button
                title={t("walkIns.changePatient")}
                variant="ghost"
                size="sm"
                onPress={() => setSelectedPatient(null)}
              />
            </Card>
          ) : null}

          <FormField label={t("walkIns.reason")}>
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t("walkIns.reasonPlaceholder")}
              placeholderTextColor={colors.textSubtle}
            />
          </FormField>

          <FormField label={t("walkIns.priority")}>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Chip
                label={t("walkIns.routine")}
                selected={priority === "routine"}
                onPress={() => setPriority("routine")}
              />
              <Chip
                label={t("walkIns.urgent")}
                tone="danger"
                selected={priority === "urgent"}
                onPress={() => setPriority("urgent")}
              />
            </View>
          </FormField>

          <Button
            title={t("walkIns.register")}
            icon={UserPlus}
            size="lg"
            onPress={onRegister}
            loading={create.isPending}
            disabled={create.isPending || !selectedPatient}
          />
        </View>
      </BottomSheet>
    </Screen>
  );
}
