import { useState } from "react";
import { View, Text, Linking, Alert, Pressable, ScrollView } from "react-native";
import {
  Users,
  Plus,
  Phone,
  MessageCircle,
  Trash2,
  X,
  Check,
} from "lucide-react-native";
import {
  useFamilyMembers,
  useAddFamilyMember,
  useDeleteFamilyMember,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  IconButton,
  ListItem,
  EmptyState,
  Skeleton,
  Avatar,
  Card,
  TextInput,
  FormField,
  Button,
  Chip,
  useToast,
} from "@/components/ui";

const RELATIONSHIPS = [
  "Spouse",
  "Father",
  "Mother",
  "Son",
  "Daughter",
  "Brother",
  "Sister",
  "Grandfather",
  "Grandmother",
  "Uncle",
  "Aunt",
  "Cousin",
  "Other",
];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function FamilyScreen() {
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();
  const { data, isLoading } = useFamilyMembers();
  const addMember = useAddFamilyMember();
  const deleteMember = useDeleteFamilyMember();
  const family: any[] = data?.family || [];

  const [composing, setComposing] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState(RELATIONSHIPS[0]);
  const [bloodGroup, setBloodGroup] = useState<string | null>(null);

  function callNumber(num?: string) {
    if (!num) {
      toast.show("No phone on file", "warning");
      return;
    }
    Linking.openURL(`tel:${num.replace(/\s/g, "")}`);
  }

  function textNumber(num?: string) {
    if (!num) {
      toast.show("No phone on file", "warning");
      return;
    }
    Linking.openURL(`sms:${num.replace(/\s/g, "")}`);
  }

  async function saveMember() {
    if (!name.trim()) {
      toast.show("Name is required", "warning");
      return;
    }
    try {
      await addMember.mutateAsync({
        name: name.trim(),
        relationship,
        phone: phone.trim() || undefined,
        bloodGroup: bloodGroup || undefined,
      });
      toast.show(`${name} added`, "success");
      setComposing(false);
      setName("");
      setPhone("");
      setRelationship(RELATIONSHIPS[0]);
      setBloodGroup(null);
    } catch (err: any) {
      toast.show(err?.message || "Could not add", "danger");
    }
  }

  function confirmDelete(member: any) {
    Alert.alert(
      `Remove ${member.name}?`,
      "Their emergency-access link will be revoked.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => deleteMember.mutate(member.id),
        },
      ]
    );
  }

  if (composing) {
    return (
      <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
        <ScreenHeader
          back
          onBack={() => setComposing(false)}
          title="Add family member"
        />
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <FormField label="Name" required>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g., Mother"
              autoCapitalize="words"
            />
          </FormField>

          <FormField label="Relationship">
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {RELATIONSHIPS.map((r) => (
                <Chip
                  key={r}
                  label={r}
                  selected={relationship === r}
                  tone={relationship === r ? "primary" : "neutral"}
                  onPress={() => setRelationship(r)}
                />
              ))}
            </View>
          </FormField>

          <FormField label="Phone" helper="Used for emergency calls & SMS">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+94 77 123 4567"
              keyboardType="phone-pad"
            />
          </FormField>

          <FormField label="Blood group" helper="Optional — used for emergency profile">
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: spacing.xs,
              }}
            >
              {BLOOD_GROUPS.map((bg) => (
                <Chip
                  key={bg}
                  label={bg}
                  selected={bloodGroup === bg}
                  tone={bloodGroup === bg ? "primary" : "neutral"}
                  onPress={() => setBloodGroup(bloodGroup === bg ? null : bg)}
                />
              ))}
            </View>
          </FormField>

          <Button
            title="Add member"
            onPress={saveMember}
            loading={addMember.isPending}
            icon={Plus}
            size="lg"
            fullWidth
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen padded={false} edges={["top"]} tabBarOffset bottomInset={false}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <ScreenHeader
          title="Family"
          subtitle={`${family.length} ${family.length === 1 ? "member" : "members"}`}
          right={
            <IconButton
              icon={Plus}
              variant="solid"
              onPress={() => setComposing(true)}
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
            actionLabel="Add member"
            onAction={() => setComposing(true)}
            tone="primary"
          />
        ) : (
          <View
            style={{
              paddingHorizontal: spacing.lg,
              gap: spacing.md,
            }}
          >
            {family.map((m) => (
              <Card key={m.id} padded={false}>
                <ListItem
                  icon={undefined}
                  iconTone="primary"
                  variant="contact"
                  mediaSlot={
                    <Avatar
                      name={m.name}
                      source={m.photo ? { uri: m.photo } : undefined}
                      size="md"
                      tone="primary"
                      ring
                    />
                  }
                  title={m.name || "Family member"}
                  subtitle={
                    [m.relationship, m.phone].filter(Boolean).join(" · ") ||
                    "Family member"
                  }
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
                        onPress={() => callNumber(m.phone)}
                        label={`Call ${m.name}`}
                      />
                      <ActionDot
                        icon={MessageCircle}
                        tone="info"
                        onPress={() => textNumber(m.phone)}
                        label={`Message ${m.name}`}
                      />
                      <ActionDot
                        icon={Trash2}
                        tone="danger"
                        onPress={() => confirmDelete(m)}
                        label={`Remove ${m.name}`}
                      />
                    </View>
                  }
                />
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
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
  tone: "success" | "info" | "danger";
  onPress: () => void;
  label: string;
}) {
  const { colors } = useTheme();
  const bg =
    tone === "success"
      ? colors.successSoft
      : tone === "info"
      ? colors.infoSoft
      : colors.dangerSoft;
  const fg =
    tone === "success"
      ? colors.success
      : tone === "info"
      ? colors.info
      : colors.danger;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
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
    </Pressable>
  );
}