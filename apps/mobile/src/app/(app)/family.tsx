import { View, Text } from "react-native";
import { Users, Plus, Phone, MessageCircle } from "lucide-react-native";
import { useFamilyMembers } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  IconButton,
  ListItem,
  EmptyState,
  Skeleton,
  Avatar,
  Pill,
  useToast,
} from "@/components/ui";

export default function FamilyScreen() {
  const { spacing, colors, typography } = useTheme();
  const { data, isLoading } = useFamilyMembers();
  const family = data?.family || [];
  const toast = useToast();

  function toastSoon(label: string) {
    toast.show(`${label} · coming soon`, "info");
  }

  return (
    <Screen scroll tabBarOffset bottomInset={false}>
      <ScreenHeader
        title="Family"
        subtitle={`${family.length} ${family.length === 1 ? "member" : "members"}`}
        right={
          <IconButton
            icon={Plus}
            variant="solid"
            onPress={() => toastSoon("Invite member")}
            accessibilityLabel="Add family member"
          />
        }
      />

      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.md,
        }}
      >
        <View
          style={{
            padding: spacing.lg,
            borderRadius: 24,
            backgroundColor: colors.primarySoft,
            flexDirection: "row",
            gap: spacing.md,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surface,
            }}
          >
            <Users size={20} color={colors.primary} strokeWidth={2.25} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[typography.title.sm, { color: colors.text }]}>
              Care together
            </Text>
            <Text
              style={[
                typography.body.sm,
                { color: colors.textMuted, marginTop: 2 },
              ]}
              numberOfLines={2}
            >
              Add family to share health info and unlock emergency access.
            </Text>
          </View>
        </View>
      </View>

      {isLoading ? (
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={84} radius={20} />
          ))}
        </View>
      ) : family.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No family members"
          message="Invite a family member to share health info and emergency access"
          actionLabel="Invite member"
          onAction={() => toastSoon("Invite flow")}
          tone="primary"
        />
      ) : (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            gap: spacing.md,
          }}
        >
          {family.map((item: any) => {
            const m = item.family_members;
            return (
              <ListItem
                key={m.id}
                icon={undefined}
                iconTone="primary"
                variant="contact"
                mediaSlot={
                  <Avatar name={m.name} size="md" tone="primary" ring />
                }
                title={m.name}
                subtitle={m.relationship || "Family member"}
                pill={
                  m.bloodGroup
                    ? { label: m.bloodGroup, tone: "danger" }
                    : undefined
                }
                rightSlot={
                  <View
                    style={{
                      flexDirection: "row",
                      gap: spacing.xs,
                    }}
                  >
                    <ActionDot
                      icon={Phone}
                      tone="success"
                      onPress={() => toastSoon(`Call ${m.name}`)}
                      label={`Call ${m.name}`}
                    />
                    <ActionDot
                      icon={MessageCircle}
                      tone="info"
                      onPress={() => toastSoon(`Message ${m.name}`)}
                      label={`Message ${m.name}`}
                    />
                  </View>
                }
                onPress={() => toastSoon(`${m.name} details`)}
              />
            );
          })}
        </View>
      )}
    </Screen>
  );
}

function ActionDot({
  icon: Icon,
  tone,
  onPress,
  label,
}: {
  icon: any;
  tone: "success" | "info";
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  const bg = tone === "success" ? colors.successSoft : colors.infoSoft;
  const fg = tone === "success" ? colors.success : colors.info;
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={label}
      onTouchEnd={onPress}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      <Icon size={16} color={fg} strokeWidth={2.5} />
    </View>
  );
}
