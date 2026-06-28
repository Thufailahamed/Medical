import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Linking,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import QRCode from "react-native-qrcode-svg";
import {
  Phone,
  AlertOctagon,
  ChevronDown,
  ChevronUp,
  UserRound,
  ShieldAlert,
  Bell,
  Plus,
  QrCode,
  Pill,
  HeartPulse,
} from "lucide-react-native";
import {
  useTriggerSOS,
  useEmergencyQR,
  usePatientProfile,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuthStore } from "@/stores/auth";
import {
  Screen,
  Card,
  BottomSheet,
  Button,
  useToast,
  Avatar,
} from "@/components/ui";

type EmergencyContact = {
  name: string;
  relationship: string;
  phone: string;
};

function parseContacts(v?: string | null): EmergencyContact[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((c) => c && typeof c === "object")
      .map((c) => ({
        name: String(c.name || "").trim(),
        relationship: String(c.relationship || "").trim(),
        phone: String(c.phone || "").trim(),
      }))
      .filter((c) => c.name || c.phone);
  } catch {
    return [];
  }
}

function parseList(v?: string | null): string[] {
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    if (Array.isArray(arr)) return arr.map((x) => String(x)).filter(Boolean);
  } catch {
    return [v];
  }
  return [];
}

export default function EmergencyScreen() {
  const router = useRouter();
  const triggerSOS = useTriggerSOS();
  const { data: qrData, isLoading: qrLoading } = useEmergencyQR();
  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { user } = useAuthStore();
  const toast = useToast();
  const { spacing, colors, typography, radius, shadow } = useTheme();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHealthId, setShowHealthId] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [pressing, setPressing] = useState(false);

  const patient = profileData?.patient?.patients;
  const userRow = profileData?.patient?.users;
  const profileName = userRow?.name || user?.name || "—";
  const profilePhoto = userRow?.photo;

  const contacts = useMemo(
    () => parseContacts(patient?.emergencyContacts),
    [patient?.emergencyContacts]
  );
  const allergies = useMemo(
    () => parseList(patient?.allergies),
    [patient?.allergies]
  );
  const conditions = useMemo(
    () => parseList(patient?.medicalConditions),
    [patient?.medicalConditions]
  );
  const currentMeds = useMemo(
    () => (qrData?.qrData?.currentMedicines as any[]) ?? [],
    [qrData]
  );
  const bloodType = patient?.bloodGroup || qrData?.qrData?.bloodGroup || null;
  const phone = userRow?.phone || qrData?.qrData?.phone || null;

  const qrPayload = useMemo(
    () => ({
      v: 1,
      id: userRow?.id || user?.id || null,
      name: profileName,
      bloodGroup: bloodType,
      allergies,
      conditions,
      phone,
      contacts,
    }),
    [userRow, user, profileName, bloodType, allergies, conditions, phone, contacts]
  );
  const qrString = JSON.stringify(qrPayload);

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
      setPressing(false);
    }
  }

  function dial(contactPhone?: string) {
    if (!contactPhone) {
      toast.show("No phone on file", "warning");
      return;
    }
    const cleaned = contactPhone.replace(/[\s()\-]/g, "");
    Linking.openURL(`tel:${cleaned}`).catch(() =>
      toast.show("Cannot place a call from this device", "warning")
    );
  }

  return (
    <Screen scroll tabBarOffset padded={false} edges={["top"]} bottomInset>
      {/* App bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.sm,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
          <Pressable
            onPress={() => router.push("/(app)/profile")}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            hitSlop={6}
          >
            <Avatar
              name={profileName}
              source={profilePhoto ? { uri: profilePhoto } : undefined}
              size="md"
              tone="primary"
            />
          </Pressable>
          <View>
            <Text
              style={[
                typography.overline,
                { color: colors.textMuted, letterSpacing: 0.6 },
              ]}
            >
              HEALTHHUB
            </Text>
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "800" },
              ]}
              numberOfLines={1}
            >
              {profileName}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={() => router.push("/(app)/notifications")}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            borderWidth: 1,
            borderColor: colors.border,
          })}
        >
          <Bell size={18} color={colors.text} strokeWidth={2.25} />
          {unread?.count ? (
            <View
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: colors.danger,
              }}
            />
          ) : null}
        </Pressable>
      </View>

      {/* SOS Centerpiece */}
      <View
        style={{
          alignItems: "center",
          paddingVertical: spacing.xl,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            alignItems: "center",
            justifyContent: "center",
            width: 240,
            height: 240,
          }}
        >
          {[240, 200, 160].map((size, idx) => {
            const opacities = [0.04, 0.08, 0.15];
            const fills = [0.015, 0.03, 0.05];
            return (
              <View
                key={size}
                style={{
                  position: "absolute",
                  width: size,
                  height: size,
                  borderRadius: size / 2,
                  borderWidth: 1,
                  borderColor: `rgba(186, 26, 26, ${opacities[idx]})`,
                  backgroundColor: `rgba(186, 26, 26, ${fills[idx]})`,
                }}
              />
            );
          })}

          <Pressable
            onPressIn={() => setPressing(true)}
            onPressOut={() => setPressing(false)}
            onLongPress={() => setConfirmOpen(true)}
            delayLongPress={1500}
            accessibilityRole="button"
            accessibilityLabel="SOS. Press and hold."
            style={({ pressed }) => ({
              width: 120,
              height: 120,
              borderRadius: 60,
              backgroundColor: pressed || pressing ? "#93000a" : "#ba1a1a",
              alignItems: "center",
              justifyContent: "center",
              shadowColor: "#ba1a1a",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 8,
              zIndex: 10,
            })}
          >
            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 28,
                fontWeight: "900",
                letterSpacing: 1,
              }}
            >
              SOS
            </Text>
          </Pressable>
        </View>

        <Text
          style={[
            typography.caption,
            {
              color: colors.textMuted,
              textAlign: "center",
              marginTop: spacing.md,
              fontWeight: "600",
            },
          ]}
        >
          Press and hold for 1.5 seconds
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.xs }}>
        {/* Health ID collapsible */}
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
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primarySoft,
              }}
            >
              <ShieldAlert size={20} color={colors.primary} strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
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
              <ChevronUp size={18} color={colors.textMuted} strokeWidth={2} />
            ) : (
              <ChevronDown size={18} color={colors.textMuted} strokeWidth={2} />
            )}
          </Pressable>

          {showHealthId ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                paddingBottom: spacing.sm,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    borderRightWidth: 1,
                    borderRightColor: colors.border,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: colors.textMuted,
                      letterSpacing: 0.5,
                    }}
                  >
                    BLOOD TYPE
                  </Text>
                  <Text
                    style={{
                      fontSize: 20,
                      fontWeight: "900",
                      color: colors.danger,
                      marginTop: 4,
                    }}
                  >
                    {bloodType || "—"}
                  </Text>
                </View>
                <View style={{ flex: 1, padding: spacing.md }}>
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: colors.textMuted,
                      letterSpacing: 0.5,
                    }}
                  >
                    PHONE
                  </Text>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: "700",
                      color: colors.text,
                      marginTop: 4,
                    }}
                    numberOfLines={1}
                  >
                    {phone || "—"}
                  </Text>
                </View>
              </View>

              <DataRow
                label="ALLERGIES"
                value={allergies.length ? allergies.join(", ") : "None on file"}
                icon={ShieldAlert}
              />
              <DataRow
                label="MEDICAL CONDITIONS"
                value={conditions.length ? conditions.join(", ") : "None on file"}
                icon={HeartPulse}
              />
              <DataRow
                label="CURRENT MEDICATIONS"
                value={
                  currentMeds.length
                    ? currentMeds
                        .map((m: any) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}`)
                        .join(", ")
                    : "None on file"
                }
                icon={Pill}
                isLast
              />
            </View>
          ) : null}
        </Card>

        {/* QR Card */}
        <Card padded={false}>
          <Pressable
            onPress={() => setShowQr((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel="Toggle health QR"
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.accentSoft,
              }}
            >
              <QrCode size={20} color={colors.accent} strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.sm, { color: colors.text, fontWeight: "800" }]}>
                Health QR
              </Text>
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                Scan to view your emergency profile
              </Text>
            </View>
            {showQr ? (
              <ChevronUp size={18} color={colors.textMuted} strokeWidth={2} />
            ) : (
              <ChevronDown size={18} color={colors.textMuted} strokeWidth={2} />
            )}
          </Pressable>

          {showQr ? (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.border,
                padding: spacing.lg,
                alignItems: "center",
                gap: spacing.md,
              }}
            >
              {qrLoading ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View
                  style={{
                    padding: spacing.md,
                    backgroundColor: colors.surface,
                    borderRadius: radius.xl,
                    borderWidth: 1,
                    borderColor: colors.border,
                    ...shadow.sm,
                  }}
                >
                  <QRCode
                    value={qrString}
                    size={200}
                    color={colors.text}
                    backgroundColor={colors.surface}
                  />
                </View>
              )}
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text
                  style={[
                    typography.title.sm,
                    { color: colors.text, fontWeight: "800" },
                  ]}
                >
                  {profileName}
                </Text>
                <Text
                  style={[typography.caption, { color: colors.textMuted }]}
                >
                  {bloodType ? `${bloodType} • ` : ""}
                  {contacts.length} contact{contacts.length === 1 ? "" : "s"}
                </Text>
              </View>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textMuted, textAlign: "center" },
                ]}
              >
                First responders can scan this code to view your allergies, conditions, and emergency contacts.
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Emergency contacts */}
        <View style={{ gap: spacing.md }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: spacing.xs,
            }}
          >
            <Text
              style={[
                typography.title.sm,
                { color: colors.text, fontWeight: "800" },
              ]}
            >
              Emergency contacts
            </Text>
            <Pressable
              onPress={() => router.push("/(app)/edit-profile")}
              accessibilityRole="button"
              accessibilityLabel="Add emergency contact"
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: spacing.sm,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: pressed ? colors.primaryMuted : colors.primarySoft,
              })}
            >
              <Plus size={14} color={colors.primary} strokeWidth={2.5} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "700",
                  color: colors.primary,
                }}
              >
                Add
              </Text>
            </Pressable>
          </View>

          {contacts.length ? (
            contacts.map((c, idx) => (
              <Card key={idx} padded={false}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: spacing.md,
                    gap: spacing.md,
                  }}
                >
                  <Avatar name={c.name || "Contact"} size="md" tone="accent" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text, fontWeight: "800" },
                      ]}
                      numberOfLines={1}
                    >
                      {c.name || "Unnamed contact"}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {[c.relationship, c.phone].filter(Boolean).join(" • ") || "No details yet"}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => dial(c.phone)}
                    accessibilityRole="button"
                    accessibilityLabel={`Call ${c.name || "contact"}`}
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: pressed ? colors.surfaceMuted : colors.primarySoft,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Phone size={18} color={colors.primary} strokeWidth={2.5} />
                  </Pressable>
                </View>
              </Card>
            ))
          ) : (
            <Card style={{ padding: spacing.lg, alignItems: "center", gap: spacing.sm }}>
              <UserRound size={22} color={colors.textMuted} strokeWidth={1.75} />
              <Text
                style={[
                  typography.title.sm,
                  { color: colors.text, fontWeight: "800" },
                ]}
              >
                No emergency contacts yet
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, textAlign: "center" },
                ]}
              >
                Add at least one trusted person in Edit Profile so first responders can reach them.
              </Text>
              <Button
                title="Add contact"
                icon={Plus}
                variant="outline"
                onPress={() => router.push("/(app)/edit-profile")}
              />
            </Card>
          )}
        </View>

        <View style={{ height: 80 }} />
      </View>

      {/* SOS confirm */}
      <BottomSheet
        visible={confirmOpen}
        onDismiss={() => setConfirmOpen(false)}
        title="Confirm emergency alert"
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Text
            style={[
              typography.body.md,
              { color: colors.text, textAlign: "center", lineHeight: 22 },
            ]}
          >
            This sends an emergency signal with your live location. Use only in a real emergency.
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              marginTop: spacing.md,
            }}
          >
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setConfirmOpen(false)}
              fullWidth
            />
            <Button
              title="Send alert"
              variant="danger"
              onPress={doSOS}
              loading={triggerSOS.isPending}
              icon={AlertOctagon}
              fullWidth
            />
          </View>
        </View>
      </BottomSheet>
    </Screen>
  );
}

function DataRow({
  label,
  value,
  icon: Icon,
  isLast,
}: {
  label: string;
  value: string;
  icon: any;
  isLast?: boolean;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <View
      style={{
        padding: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: colors.border,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: colors.surfaceMuted,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={colors.textMuted} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: "700",
            color: colors.textMuted,
            letterSpacing: 0.5,
          }}
        >
          {label}
        </Text>
        <Text
          style={[
            typography.body.sm,
            { color: colors.text, fontWeight: "700", marginTop: 2, lineHeight: 20 },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}