import { useState } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { CalendarClock, Check, Clock4 } from "lucide-react-native";
import { useFollowUps } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Pill as PillCmp,
  EmptyState,
  Skeleton,
  ChipGroup,
  ListItem,
} from "@/components/ui";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "all", label: "All" },
];

export default function FollowUpsScreen() {
  const router = useRouter();
  const { spacing, colors, typography } = useTheme();
  const [tab, setTab] = useState("upcoming");
  const { data, isLoading } = useFollowUps({ upcoming: tab === "upcoming" });
  const list = data?.followUps || [];

  return (
    <Screen padded={false} edges={["top"]} bottomInset>
      <ScreenHeader
        back
        onBack={() => router.back()}
        title="Follow-ups"
        subtitle="Past and scheduled"
      />

      <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md }}>
        <ChipGroup options={TABS} value={tab} onChange={setTab} />
      </View>

      {isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} height={80} radius={20} />
          ))}
        </View>
      ) : list.length === 0 ? (
        <View style={{ padding: spacing.lg }}>
          <EmptyState
            icon={CalendarClock}
            title="No follow-ups"
            message={
              tab === "upcoming"
                ? "Nothing on the schedule."
                : "Schedule a follow-up from any patient detail screen."
            }
            tone="neutral"
          />
        </View>
      ) : (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {list.map((f: any) => {
            const today = new Date().toISOString().split("T")[0];
            const upcoming = f.followUpDate >= today;
            return (
              <Card key={f.id} padded={false}>
                <View style={{ padding: spacing.lg, gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    {upcoming ? (
                      <Clock4 size={18} color={colors.primary} strokeWidth={2.2} />
                    ) : (
                      <Check size={18} color={colors.success} strokeWidth={2.2} />
                    )}
                    <Text
                      style={[typography.title.sm, { color: colors.text, flex: 1 }]}
                      numberOfLines={2}
                    >
                      {f.title}
                    </Text>
                    <PillCmp
                      label={f.followUpDate}
                      tone={upcoming ? "primary" : "neutral"}
                      size="sm"
                    />
                  </View>
                  {f.notes ? (
                    <Text
                      style={[typography.body.sm, { color: colors.textMuted }]}
                      numberOfLines={3}
                    >
                      {f.notes}
                    </Text>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}