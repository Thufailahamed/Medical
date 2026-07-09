import { View, Text, ScrollView } from "react-native";
import {
  History,
  Eye,
  Plus,
  Pencil,
  Trash2,
  Bell,
  ShieldAlert,
} from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useAuditLog } from "@/hooks/useApi";
import { useLocaleStore } from "@/stores/locale";
import { fmtDateTime } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  ListItem,
  Skeleton,
  EmptyState,
  ErrorState,
} from "@/components/ui";

// ACTION_META stores i18n keys (not raw strings) so translators can swap
// every audit-log verb label without code changes. The fallback in
// `metaFor` handles action codes the server might send that we haven't
// enumerated yet.
const ACTION_META: Record<string, { labelKey: string; icon: any; tone: any }> = {
  "emergency.sos": { labelKey: "activity.action.emergencySos", icon: ShieldAlert, tone: "danger" },
  "record.view": { labelKey: "activity.action.recordView", icon: Eye, tone: "primary" },
  "record.create": { labelKey: "activity.action.recordCreate", icon: Plus, tone: "success" },
  "record.update": { labelKey: "activity.action.recordUpdate", icon: Pencil, tone: "warning" },
  "record.delete": { labelKey: "activity.action.recordDelete", icon: Trash2, tone: "danger" },
  "notification.send": { labelKey: "activity.action.notificationSend", icon: Bell, tone: "accent2" },
};

function metaFor(action: string): { labelKey: string | null; icon: any; tone: any } {
  return (
    ACTION_META[action] || {
      labelKey: null,
      icon: History,
      tone: "neutral",
    }
  );
}

export default function ActivityScreen() {
  const { t } = useTranslation();
  const locale = useLocaleStore((s) => s.locale);
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading, isError, refetch } = useAuditLog();
  const entries: any[] = data?.auditLogs || [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("activity.title")}
        subtitle={t("activity.subtitle")}
      />
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </View>
      ) : isError ? (
        <ErrorState
          title={t("recordDetail.errorTitle", "Couldn't load activity")}
          message={t("recordDetail.errorBody", "Check your connection and try again.")}
          actionLabel={t("common.retry")}
          onAction={() => refetch()}
        />
      ) : entries.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={History}
            title={t("activity.empty.title")}
            message={t("activity.empty.message")}
            tone="neutral"
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        >
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginBottom: spacing.md },
            ]}
          >
            {t("activity.helperText")}
          </Text>
          <Card padded={false}>
            {entries.map((e, idx) => {
              const meta = metaFor(e.action);
              const Icon = meta.icon;
              const title = meta.labelKey
                ? t(meta.labelKey)
                : e.action.replace(/[._]/g, " ");
              return (
                <ListItem
                  key={e.id || idx}
                  icon={Icon}
                  iconTone={meta.tone}
                  title={title}
                  subtitle={`${e.resource || ""}${
                    e.resourceId ? ` · ${e.resourceId.slice(-6)}` : ""
                  } · ${fmtDateTime(new Date(e.createdAt), locale)}`}
                />
              );
            })}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}