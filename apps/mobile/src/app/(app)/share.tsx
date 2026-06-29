// @ts-nocheck

import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  ActivityIndicator,
  Share as RNShare,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import {
  Share2,
  Link as LinkIcon,
  Clock,
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  XCircle,
} from "lucide-react-native";
import {
  useShareLinks,
  useCreateShareLink,
  useRevokeShareLink,
  type ShareLink,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  BottomSheet,
  FormField,
  TextInput,
  useToast,
} from "@/components/ui";

const DURATIONS = [
  { value: 1, label: "1 hour" },
  { value: 24, label: "1 day" },
  { value: 168, label: "1 week" },
  { value: 720, label: "30 days" },
];

export default function ShareScreen() {
  const router = useRouter();
  const { spacing, colors, typography, radius } = useTheme();
  const toast = useToast();
  const { data, isLoading, refetch } = useShareLinks();
  const create = useCreateShareLink();
  const revoke = useRevokeShareLink();

  const links: ShareLink[] = data?.links || [];

  const [sheetOpen, setSheetOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [scope, setScope] = useState("all");
  const [hours, setHours] = useState(24);
  const [lastToken, setLastToken] = useState<string | null>(null);

  async function onCreate() {
    try {
      const res = await create.mutateAsync({
        label: label.trim() || "Shared record",
        scope,
        expiresInHours: hours,
      });
      setLastToken(res.token);
      setSheetOpen(false);
      setLabel("");
      toast.show({ message: "Share link created", tone: "success" });
    } catch (e: any) {
      toast.show({ message: e?.message || "Create failed", tone: "danger" });
    }
  }

  async function onShareLink(link: ShareLink) {
    try {
      const base =
        (process.env as any)?.EXPO_PUBLIC_PUBLIC_URL ||
        (process.env as any)?.EXPO_PUBLIC_API_URL?.replace(/\/api$/, "") ||
        "";
      const url = `${base}/share/${link.token}`;
      await RNShare.share({
        message: `HealthHub record: ${link.label || "Shared record"}\n${url}\n\nExpires ${new Date(
          link.expiresAt
        ).toLocaleString()}`,
      });
    } catch (e: any) {
      toast.show({ message: e?.message || "Share failed", tone: "danger" });
    }
  }

  function onRevoke(link: ShareLink) {
    Alert.alert("Revoke link?", "Viewers will no longer be able to access it.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Revoke",
        style: "destructive",
        onPress: async () => {
          try {
            await revoke.mutateAsync(link.id);
            toast.show({ message: "Link revoked", tone: "success" });
          } catch (e: any) {
            toast.show({ message: e?.message || "Revoke failed", tone: "danger" });
          }
        },
      },
    ]);
  }

  function isExpired(l: ShareLink) {
    return new Date(l.expiresAt) < new Date();
  }

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title="Share with doctor"
        subtitle="Time-limited links to your record"
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
            <LinkIcon size={20} color={colors.primary} />
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "800", flex: 1 },
              ]}
            >
              How it works
            </Text>
          </View>
          <Text
            style={[
              typography.body.sm,
              { color: colors.textMuted, marginTop: 4, lineHeight: 20 },
            ]}
          >
            Create a link that anyone (no app required) can open to view your
            allergies, active medicines, and last 6 months of records. Links
            expire automatically. You can revoke at any time.
          </Text>
        </Card>

        <Button
          title="Create share link"
          icon={Plus}
          onPress={() => setSheetOpen(true)}
          size="lg"
        />

        {isLoading ? (
          <ActivityIndicator
            color={colors.primary}
            style={{ marginTop: spacing.lg }}
          />
        ) : links.length === 0 ? (
          <EmptyState
            icon={Share2}
            title="No links yet"
            message="Create a time-limited link to share with a doctor."
          />
        ) : (
          links.map((l) => {
            const expired = isExpired(l) || l.revoked;
            return (
              <Card key={l.id}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.sm,
                    marginBottom: spacing.xs,
                  }}
                >
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, fontWeight: "700", flex: 1 },
                    ]}
                    numberOfLines={1}
                  >
                    {l.label || "Shared record"}
                  </Text>
                  {expired ? (
                    <Chip
                      label={l.revoked ? "Revoked" : "Expired"}
                      tone="neutral"
                      size="sm"
                    />
                  ) : (
                    <Chip label="Active" tone="success" size="sm" />
                  )}
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginTop: 2,
                  }}
                >
                  <Clock size={12} color={colors.textMuted} />
                  <Text style={[typography.caption, { color: colors.textMuted }]}>
                    {expired
                      ? `Expired ${new Date(l.expiresAt).toLocaleDateString()}`
                      : `Expires ${new Date(l.expiresAt).toLocaleString()}`}
                  </Text>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    gap: spacing.xs,
                    marginTop: spacing.sm,
                  }}
                >
                  {!expired && (
                    <Button
                      title="Share"
                      icon={Share2}
                      onPress={() => onShareLink(l)}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                  )}
                  {!expired && (
                    <Button
                      title="Revoke"
                      icon={Trash2}
                      variant="outline"
                      tone="danger"
                      onPress={() => onRevoke(l)}
                      size="sm"
                      style={{ flex: 1 }}
                    />
                  )}
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      <BottomSheet
        visible={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        title="Create share link"
      >
        <View style={{ gap: spacing.md }}>
          <FormField label="Label (optional)">
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder="e.g. Dr Smith visit 2024"
              placeholderTextColor={colors.textSubtle}
              style={{
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: radius.md,
                padding: spacing.md,
                color: colors.text,
                fontSize: 16,
              }}
            />
          </FormField>

          <FormField label="Scope">
            <ChipGroup
              options={[
                { value: "all", label: "All records" },
                { value: "recent6m", label: "Last 6 months" },
              ]}
              value={scope}
              onChange={setScope}
            />
          </FormField>

          <FormField label="Duration">
            <ChipGroup
              options={DURATIONS.map((d) => ({
                value: String(d.value),
                label: d.label,
              }))}
              value={String(hours)}
              onChange={(v) => setHours(parseInt(v, 10))}
            />
          </FormField>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.xs,
              padding: spacing.sm,
              backgroundColor: colors.warningSoft,
              borderRadius: radius.md,
            }}
          >
            <XCircle size={16} color={colors.warning} />
            <Text
              style={[
                typography.caption,
                { color: colors.text, flex: 1, lineHeight: 18 },
              ]}
            >
              Anyone with the link can view your shared data. You can revoke
              access at any time.
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setSheetOpen(false)}
              style={{ flex: 1 }}
            />
            <Button
              title="Create"
              icon={CheckCircle2}
              onPress={onCreate}
              loading={create.isPending}
              style={{ flex: 1 }}
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}