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
import { useAuditLog } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  ListItem,
  Avatar,
  Skeleton,
  EmptyState,
} from "@/components/ui";

const ACTION_META: Record<string, { label: string; icon: any; tone: any }> = {
  "emergency.sos": { label: "Emergency SOS triggered", icon: ShieldAlert, tone: "danger" },
  "record.view": { label: "Record viewed", icon: Eye, tone: "primary" },
  "record.create": { label: "Record created", icon: Plus, tone: "success" },
  "record.update": { label: "Record updated", icon: Pencil, tone: "warning" },
  "record.delete": { label: "Record deleted", icon: Trash2, tone: "danger" },
  "notification.send": { label: "Notification sent", icon: Bell, tone: "accent2" },
};

function metaFor(action: string) {
  return (
    ACTION_META[action] || {
      label: action.replace(/[._]/g, " "),
      icon: History,
      tone: "neutral",
    }
  );
}

export default function ActivityScreen() {
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading } = useAuditLog();
  const entries: any[] = data?.auditLogs || [];

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Activity log"
        subtitle="Who accessed your records"
      />
      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
          <Skeleton height={64} radius={16} />
        </View>
      ) : entries.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={History}
            title="No activity yet"
            message="Your access log will appear here once you start using the app."
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
            Your right-of-access log. We record every action that touches
            your records. Tap any entry for details.
          </Text>
          <Card padded={false}>
            {entries.map((e, idx) => {
              const meta = metaFor(e.action);
              const Icon = meta.icon;
              return (
                <ListItem
                  key={e.id || idx}
                  icon={Icon}
                  iconTone={meta.tone}
                  title={meta.label}
                  subtitle={`${e.resource || ""}${
                    e.resourceId ? ` · ${e.resourceId.slice(-6)}` : ""
                  } · ${new Date(e.createdAt).toLocaleString()}`}
                />
              );
            })}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}