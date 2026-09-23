import React, { useState } from "react";
import { View, Text, Alert } from "react-native";
import { Megaphone, Send, Radio } from "lucide-react-native";
import {
  Screen,
  Button,
  TextInput,
  ChipGroup,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useBroadcast } from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminSection,
  AdminCard,
  IconTile,
  roleLabel,
} from "@/components/admin/ui";

const ROLE_OPTS = [
  { label: "All roles", value: "" },
  { label: "Patients", value: "patient" },
  { label: "Doctors", value: "doctor" },
  { label: "Hospitals", value: "hospital_admin" },
  { label: "Labs", value: "laboratory" },
  { label: "Pharmacy", value: "pharmacy" },
  { label: "Insurance", value: "insurance" },
  { label: "Ambulance", value: "ambulance" },
];

const AUDIENCE_OPTS = [
  { label: "All accounts", value: "all" },
  { label: "Active only", value: "active" },
];

export default function AdminBroadcastScreen() {
  const { colors, spacing, typography } = useTheme();
  const toast = useToast();
  const broadcast = useBroadcast();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [role, setRole] = useState("");
  const [audience, setAudience] = useState<"all" | "active">("all");

  const valid = title.trim().length > 0 && body.trim().length > 0;

  const send = () => {
    const target = role ? roleLabel(role) + "s" : "all roles";
    Alert.alert(
      "Send broadcast",
      `Send "${title.trim()}" to ${target}${audience === "active" ? " (active only)" : ""}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send",
          onPress: () =>
            broadcast.mutate(
              {
                title: title.trim(),
                body: body.trim(),
                role: role || undefined,
                audience,
              },
              {
                onSuccess: (res) => {
                  toast.show(`Sent to ${res?.sent ?? 0} users`, "success");
                  setTitle("");
                  setBody("");
                },
                onError: (e: any) =>
                  toast.show(e?.message ?? "Broadcast failed", "danger"),
              }
            ),
        },
      ]
    );
  };

  return (
    <Screen scroll padded={false} edges={["top"]}>
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Growth"
          title="Broadcast"
          subtitle="Send an in-app notification to users"
          icon={Megaphone}
        />
      </View>

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
          paddingBottom: spacing.xxl,
          marginTop: spacing.xl,
        }}
      >
        <View>
          <AdminSection title="Message" />
          <AdminCard>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
                marginBottom: spacing.md,
              }}
            >
              <IconTile icon={Radio} tone="warning" size={34} />
              <Text style={[typography.title.sm, { color: colors.text }]}>
                New broadcast
              </Text>
            </View>
            <View style={{ gap: spacing.md }}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Title (max 120 chars)"
                maxLength={120}
              />
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Message body (max 500 chars)"
                multiline
                numberOfLines={4}
                maxLength={500}
                style={{ minHeight: 96, textAlignVertical: "top" }}
              />
            </View>
          </AdminCard>
        </View>

        <View>
          <AdminSection title="Target role" />
          <ChipGroup
            options={ROLE_OPTS}
            value={role}
            onChange={(v: string) => setRole(v)}
          />
        </View>

        <View>
          <AdminSection title="Audience" />
          <ChipGroup
            options={AUDIENCE_OPTS}
            value={audience}
            onChange={(v: string) => setAudience(v as any)}
          />
        </View>

        <Button
          title="Send broadcast"
          icon={Send}
          onPress={send}
          loading={broadcast.isPending}
          disabled={!valid}
        />
      </View>
    </Screen>
  );
}
