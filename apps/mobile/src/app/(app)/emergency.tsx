import { useState } from "react";
import { View, Text, Pressable, Linking } from "react-native";
import * as Location from "expo-location";
import {
  Phone,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  UserRound,
  MapPin,
  ShieldAlert,
} from "lucide-react-native";
import { useTriggerSOS, useEmergencyQR } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone } from "@/theme/tone";
import {
  Screen,
  ScreenHeader,
  SOSButton,
  Card,
  Divider,
  ListItem,
  BottomSheet,
  Button,
  EmptyState,
  useToast,
} from "@/components/ui";

export default function EmergencyScreen() {
  const triggerSOS = useTriggerSOS();
  const { data: qrData } = useEmergencyQR();
  const toast = useToast();
  const { spacing, colors, typography } = useTheme();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHealthId, setShowHealthId] = useState(false);

  const qr = qrData?.qrData;
  const danger = useTone("danger");

  async function doSOS() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast.show("Location permission required", "warning");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      await triggerSOS.mutateAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      toast.show("Emergency alert sent. Help is on the way.", "success");
    } catch (err: any) {
      toast.show(err?.message || "Could not send alert", "danger");
    } finally {
      setConfirmOpen(false);
    }
  }

  function dial(phone?: string) {
    if (!phone) {
      toast.show("No phone on file", "warning");
      return;
    }
    Linking.openURL(`tel:${phone.replace(/\s+/g, "")}`);
  }

  return (
    <Screen scroll tabBarOffset padded={false} edges={["top"]}>
      <ScreenHeader
        title="Emergency"
        subtitle="Quick access when you need it most"
      />

      <View
        style={{
          alignItems: "center",
          paddingTop: spacing.md,
          paddingBottom: spacing.lg,
          gap: spacing.sm,
        }}
      >
        <SOSButton onActivate={() => setConfirmOpen(true)} size={220} />
        <Text
          style={[
            typography.caption,
            { color: colors.textMuted, textAlign: "center" },
          ]}
        >
          Press and hold for 1.5 seconds to alert contacts + nearby hospitals
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg }}>
        {/* Health ID — collapsible */}
        <Card padded={false}>
          <Pressable
            onPress={() => setShowHealthId((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle health ID"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: danger.bg,
              }}
            >
              <ShieldAlert size={20} color={danger.fg} strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.sm, { color: colors.text }]}>
                Health ID
              </Text>
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                Critical info for first responders
              </Text>
            </View>
            {showHealthId ? (
              <ChevronUp size={18} color={colors.textSubtle} strokeWidth={2.25} />
            ) : (
              <ChevronDown size={18} color={colors.textSubtle} strokeWidth={2.25} />
            )}
          </Pressable>

          {showHealthId ? (
            <>
              <Divider />
              <View style={{ paddingVertical: spacing.xs }}>
                <HealthRow label="Name" value={qr?.name} />
                <HealthRow label="Blood group" value={qr?.bloodGroup} highlight />
                <HealthRow
                  label="Allergies"
                  value={qr?.allergies?.join(", ") || "None"}
                />
                <HealthRow
                  label="Conditions"
                  value={qr?.medicalConditions?.join(", ") || "None"}
                />
                <HealthRow
                  label="Medicines"
                  value={
                    qr?.currentMedicines?.length
                      ? qr.currentMedicines
                          .map((m: any) => `${m.name} ${m.dosage}`)
                          .join(", ")
                      : "None"
                  }
                />
                <HealthRow label="Phone" value={qr?.phone} />
              </View>
            </>
          ) : null}
        </Card>

        {/* Emergency contacts */}
        <View style={{ gap: spacing.sm }}>
          <SectionLabel icon={UserRound} label="Emergency contacts" />
          {qr?.emergencyContacts?.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              {qr.emergencyContacts.map((c: any, i: number) => (
                <ListItem
                  key={i}
                  variant="contact"
                  iconTone="danger"
                  icon={Phone}
                  title={c.name}
                  subtitle={c.relationship}
                  trailing={
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 999,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: danger.bg,
                      }}
                    >
                      <Phone size={18} color={danger.fg} strokeWidth={2.5} />
                    </View>
                  }
                  onPress={() => dial(c.phone)}
                />
              ))}
            </View>
          ) : (
            <EmptyState
              icon={UserRound}
              title="No emergency contacts"
              message="Add emergency contacts in your profile so we can alert them when you trigger SOS."
              tone="neutral"
            />
          )}
        </View>

        {/* Nearby hospitals — backend pending */}
        <View style={{ gap: spacing.sm }}>
          <SectionLabel icon={MapPin} label="Nearby hospitals" />
          <EmptyState
            icon={MapPin}
            title="Hospital lookup coming soon"
            message="Once we have geolocation-based hospital data, we'll show the nearest 24/7 emergency centers here."
            tone="accent2"
          />
        </View>

        <View style={{ height: spacing.xl }} />
      </View>

      <BottomSheet
        visible={confirmOpen}
        onDismiss={() => setConfirmOpen(false)}
        title="Confirm emergency alert"
      >
        <View style={{ gap: spacing.md }}>
          <Text
            style={[
              typography.body.md,
              { color: colors.text, textAlign: "center" },
            ]}
          >
            This will send an emergency alert with your live location to your
            emergency contacts and nearby hospitals.
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              paddingTop: spacing.md,
            }}
          >
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setConfirmOpen(false)}
              fullWidth={false}
            />
            <View style={{ flex: 1 }}>
              <Button
                title="Send alert"
                variant="danger"
                onPress={doSOS}
                loading={triggerSOS.isPending}
                icon={AlertOctagon}
              />
            </View>
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function SectionLabel({
  icon: Icon,
  label,
}: {
  icon: any;
  label: string;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.xs,
        paddingHorizontal: spacing.xs,
      }}
    >
      <Icon size={14} color={colors.textMuted} strokeWidth={2.25} />
      <Text style={[typography.title.sm, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

function HealthRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value?: string;
  highlight?: boolean;
}) {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        gap: spacing.md,
      }}
    >
      <Text
        style={[
          typography.label.md,
          {
            color: colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: 0.6,
          },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          highlight ? typography.title.md : typography.body.md,
          {
            color: highlight ? colors.danger : colors.text,
            fontWeight: highlight ? "800" : "600",
            flex: 1,
            textAlign: "right",
          },
        ]}
        numberOfLines={2}
      >
        {value || "—"}
      </Text>
    </View>
  );
}
