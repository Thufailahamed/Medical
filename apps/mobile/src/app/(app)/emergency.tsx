import { useRouter } from "expo-router";
import { useMemo, useState, useEffect } from "react";
import {
  getEmergencyProfile,
  setEmergencyProfile,
  getLastMeds,
  getLastAllergies,
  type CachedEmergencyProfile,
} from "@/lib/offline-cache";
import { getApiBaseUrl } from "@/lib/api";
import {
  View,
  Text,
  Pressable,
  Linking,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
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
  ArrowLeft,
} from "lucide-react-native";
import {
  useTriggerSOS,
  useEmergencyQR,
  usePatientProfile,
  useUnreadCount,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import { withOpacity } from "@/constants/theme";
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
  const { t } = useTranslation();
  const triggerSOS = useTriggerSOS();
  const { data: qrData, isLoading: qrLoading } = useEmergencyQR();
  const { data: profileData } = usePatientProfile();
  const { data: unread } = useUnreadCount();
  const { user } = useAuthStore();
  const toast = useToast();
  const { spacing, colors, typography, radius, shadow, scheme } = useTheme();

  useEffect(() => {
    if (user?.role === "doctor") {
      router.replace("/(doctor)" as any);
    }
  }, [user]);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showHealthId, setShowHealthId] = useState(true);
  const [showQr, setShowQr] = useState(true);
  const [pressing, setPressing] = useState(false);

  // V3: offline-cache fallback for emergency profile
  const [cached, setCached] = useState<CachedEmergencyProfile | null>(null);
  useEffect(() => {
    getEmergencyProfile().then(setCached);
  }, []);
  useEffect(() => {
    // Re-fetch meds/allergies from cache for emergency
    (async () => {
      const [meds, allergies] = await Promise.all([
        getLastMeds(),
        getLastAllergies(),
      ]);
      setCached((prev) => ({
        ...(prev || {
          generatedAt: new Date().toISOString(),
        }),
        activeMedicines: meds,
        allergies,
      }));
    })();
  }, []);

  useEffect(() => {
    // Write-back fresh data to cache when profile loads
    const p = profileData?.patient?.patients;
    if (p) {
      setEmergencyProfile({
        ...(cached || {}),
        generatedAt: new Date().toISOString(),
        bloodGroup: p.bloodGroup,
        dateOfBirth: p.dateOfBirth,
        conditions: (cached as any)?.conditions,
      });
    }
  }, [profileData]);

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
  const qrString = useMemo(() => {
    // Custom base64 helper for React Native
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    const str = JSON.stringify(qrPayload);
    let base64 = "";
    for (let i = 0; i < str.length; i += 3) {
      const c1 = str.charCodeAt(i);
      const c2 = i + 1 < str.length ? str.charCodeAt(i + 1) : NaN;
      const c3 = i + 2 < str.length ? str.charCodeAt(i + 2) : NaN;
      const byte1 = c1 >> 2;
      const byte2 = ((c1 & 3) << 4) | (Number.isNaN(c2) ? 0 : c2 >> 4);
      const byte3 = Number.isNaN(c2) ? 64 : ((c2 & 15) << 2) | (Number.isNaN(c3) ? 0 : c3 >> 6);
      const byte4 = Number.isNaN(c3) ? 64 : c3 & 63;
      base64 += chars.charAt(byte1) + chars.charAt(byte2) + chars.charAt(byte3) + chars.charAt(byte4);
    }
    const apiUrl = getApiBaseUrl();
    return `${apiUrl || "http://localhost:8787"}/emergency/card/view?data=${encodeURIComponent(base64)}`;
  }, [qrPayload]);

  async function doSOS() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        toast.show(t("emergency.toast.permission"), "warning");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      await triggerSOS.mutateAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
      toast.show(t("emergency.toast.sent"), "success");
    } catch (err: any) {
      toast.show(err?.message || t("emergency.toast.sendError"), "danger");
    } finally {
      setConfirmOpen(false);
      setPressing(false);
    }
  }

  function dial(contactPhone?: string) {
    if (!contactPhone) {
      toast.show(t("emergency.toast.noPhone"), "warning");
      return;
    }
    const cleaned = contactPhone.replace(/[\s()\-]/g, "");
    Linking.openURL(`tel:${cleaned}`).catch(() =>
      toast.show(t("emergency.toast.cannotCall"), "warning")
    );
  }

  return (
    <Screen scroll padded={false} edges={["top"]} bottomInset>
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
          {router.canGoBack() && (
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={({ pressed }) => ({
                width: 40,
                height: 40,
                borderRadius: 20,
                alignItems: "center",
                justifyContent: "center",
                marginRight: spacing.xs,
                backgroundColor: pressed ? colors.fillStrong : colors.fill,
              })}
            >
              <ArrowLeft size={20} color={colors.text} strokeWidth={2.4} />
            </Pressable>
          )}
          <Pressable
            onPress={() => router.push("/(app)/profile")}
            accessibilityRole="button"
            accessibilityLabel={t("emergency.header.accessibilityOpenProfile")}
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
                { color: colors.danger },
              ]}
            >
              {t("emergency.header.brand")}
            </Text>
            <Text
              style={[
                typography.title.md,
                { color: colors.text },
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
          accessibilityLabel={t("emergency.header.accessibilityNotifications")}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: pressed ? colors.fillStrong : colors.fill,
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
                borderWidth: 1.5,
                borderColor: colors.bg,
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
                  borderWidth: StyleSheet.hairlineWidth,
                  borderColor: withOpacity(colors.danger, opacities[idx] * 2),
                  backgroundColor: withOpacity(colors.danger, fills[idx] * (scheme === "dark" ? 2.4 : 1.6)),
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
            accessibilityLabel={t("emergency.sos.accessibilityLabel")}
            style={({ pressed }) => ({
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: pressed || pressing ? "#B3261E" : "#E5362F",
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: "rgba(255,255,255,0.22)",
              shadowColor: "#E5362F",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: scheme === "dark" ? 0 : 0.35,
              shadowRadius: 20,
              elevation: 8,
              zIndex: 10,
              transform: [{ scale: pressed || pressing ? 0.95 : 1 }],
            })}
          >
            <Text
              style={[
                typography.display.md,
                {
                  color: "#FFFFFF",
                  fontSize: 32,
                  lineHeight: 38,
                  letterSpacing: 1.5,
                },
              ]}
            >
              SOS
            </Text>
          </Pressable>
        </View>

        <Text
          style={[
            typography.label.md,
            {
              color: colors.textMuted,
              textAlign: "center",
              marginTop: spacing.md,
            },
          ]}
        >
          {t("emergency.sos.hint")}
        </Text>
      </View>

      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, marginTop: spacing.xs }}>
        {/* Health ID collapsible */}
        <Card padded={false}>
          <Pressable
            onPress={() => setShowHealthId((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={t("emergency.healthId.accessibilityLabel")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.danger,
              }}
            >
              <ShieldAlert size={19} color="#FFFFFF" strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {t("emergency.healthId.title")}
              </Text>
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {t("emergency.healthId.subtitle")}
              </Text>
            </View>
            {showHealthId ? (
              <ChevronUp size={18} color={colors.textSubtle} strokeWidth={2.2} />
            ) : (
              <ChevronDown size={18} color={colors.textSubtle} strokeWidth={2.2} />
            )}
          </Pressable>

          {showHealthId ? (
            <View
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
                paddingBottom: spacing.xs,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  gap: spacing.sm,
                  padding: spacing.md,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: colors.separator,
                }}
              >
                <View
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    backgroundColor: colors.dangerSoft,
                  }}
                >
                  <Text
                    style={[typography.caption, { color: colors.danger }]}
                  >
                    {t("emergency.healthId.bloodType")}
                  </Text>
                  <Text
                    style={[
                      typography.display.md,
                      { color: colors.danger, marginTop: 2 },
                    ]}
                  >
                    {bloodType || "—"}
                  </Text>
                </View>
                <View
                  style={{
                    flex: 1,
                    padding: spacing.md,
                    borderRadius: 16,
                    borderCurve: "continuous",
                    backgroundColor: colors.fill,
                    justifyContent: "space-between",
                  }}
                >
                  <Text
                    style={[typography.caption, { color: colors.textSubtle }]}
                  >
                    {t("emergency.healthId.phone")}
                  </Text>
                  <Text
                    style={[
                      typography.title.sm,
                      { color: colors.text, marginTop: 4 },
                    ]}
                    numberOfLines={1}
                  >
                    {phone || "—"}
                  </Text>
                </View>
              </View>

              <DataRow
                label={t("emergency.healthId.allergies")}
                value={allergies.length ? allergies.join(", ") : t("emergency.healthId.noneOnFile")}
                icon={ShieldAlert}
              />
              <DataRow
                label={t("emergency.healthId.conditions")}
                value={conditions.length ? conditions.join(", ") : t("emergency.healthId.noneOnFile")}
                icon={HeartPulse}
              />
              <DataRow
                label={t("emergency.healthId.medications")}
                value={
                  currentMeds.length
                    ? currentMeds
                        .map((m: any) => `${m.name}${m.dosage ? ` ${m.dosage}` : ""}`)
                        .join(", ")
                    : t("emergency.healthId.noneOnFile")
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
            accessibilityLabel={t("emergency.qr.accessibilityLabel")}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              padding: spacing.lg,
            }}
          >
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                borderCurve: "continuous",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.accent,
              }}
            >
              <QrCode size={19} color="#FFFFFF" strokeWidth={2.25} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[typography.title.md, { color: colors.text }]}>
                {t("emergency.qr.title")}
              </Text>
              <Text
                style={[typography.body.sm, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {t("emergency.qr.subtitle")}
              </Text>
            </View>
            {showQr ? (
              <ChevronUp size={18} color={colors.textSubtle} strokeWidth={2.2} />
            ) : (
              <ChevronDown size={18} color={colors.textSubtle} strokeWidth={2.2} />
            )}
          </Pressable>

          {showQr ? (
            <View
              style={{
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
                padding: spacing.xl,
                alignItems: "center",
                gap: spacing.lg,
              }}
            >
              {!profileData && !cached ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <View
                  style={{
                    padding: spacing.lg,
                    backgroundColor: "#FFFFFF",
                    borderRadius: radius.xl,
                    borderCurve: "continuous",
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: colors.separator,
                    ...(scheme === "dark" ? null : shadow.sm),
                  }}
                >
                  <QRCode
                    value={qrString}
                    size={200}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                </View>
              )}
              <View style={{ alignItems: "center", gap: 4 }}>
                <Text
                  style={[
                    typography.title.lg,
                    { color: colors.text },
                  ]}
                >
                  {profileName}
                </Text>
                <Text
                  style={[typography.body.sm, { color: colors.textMuted }]}
                >
                  {bloodType ? `${bloodType} • ` : ""}
                  {t("emergency.qr.contactsCount", { count: contacts.length })}
                </Text>
              </View>
              <Text
                style={[
                  typography.caption,
                  { color: colors.textSubtle, textAlign: "center", maxWidth: 280 },
                ]}
              >
                {t("emergency.qr.footer")}
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
                typography.title.lg,
                { color: colors.text },
              ]}
            >
              {t("emergency.contacts.title")}
            </Text>
            <Pressable
              onPress={() => router.push("/(app)/edit-profile")}
              accessibilityRole="button"
              accessibilityLabel={t("emergency.contacts.addContactLabel")}
              hitSlop={8}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                height: 36,
                paddingHorizontal: spacing.md,
                borderRadius: 999,
                backgroundColor: colors.primarySoft,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Plus size={15} color={colors.primary} strokeWidth={2.5} />
              <Text
                style={[typography.label.md, { color: colors.primary }]}
              >
                {t("emergency.contacts.addButton")}
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
                    paddingVertical: spacing.md,
                    paddingHorizontal: spacing.lg,
                    gap: spacing.md,
                  }}
                >
                  <Avatar name={c.name || "Contact"} size="md" tone="accent" />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      style={[
                        typography.title.sm,
                        { color: colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {c.name || t("emergency.contacts.unnamedContact")}
                    </Text>
                    <Text
                      style={[
                        typography.body.sm,
                        { color: colors.textMuted, marginTop: 2 },
                      ]}
                      numberOfLines={1}
                    >
                      {[c.relationship, c.phone].filter(Boolean).join(" • ") || t("emergency.contacts.noDetails")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => dial(c.phone)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      c.name
                        ? t("emergency.contacts.callLabel", { name: c.name })
                        : t("emergency.contacts.callFallback")
                    }
                    style={({ pressed }) => ({
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: colors.success,
                      opacity: pressed ? 0.8 : 1,
                      alignItems: "center",
                      justifyContent: "center",
                    })}
                  >
                    <Phone size={18} color="#FFFFFF" strokeWidth={2.5} />
                  </Pressable>
                </View>
              </Card>
            ))
          ) : (
            <Card style={{ padding: spacing.xl, alignItems: "center", gap: spacing.sm }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 18,
                  borderCurve: "continuous",
                  backgroundColor: colors.fill,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: spacing.xs,
                }}
              >
                <UserRound size={26} color={colors.textMuted} strokeWidth={1.75} />
              </View>
              <Text
                style={[
                  typography.title.md,
                  { color: colors.text },
                ]}
              >
                {t("emergency.contacts.noContactsTitle")}
              </Text>
              <Text
                style={[
                  typography.body.sm,
                  { color: colors.textMuted, textAlign: "center" },
                ]}
              >
                {t("emergency.contacts.noContactsBody")}
              </Text>
              <Button
                title={t("emergency.contacts.addContactCta")}
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
        title={t("emergency.confirm.title")}
      >
        <View style={{ gap: spacing.md, paddingBottom: spacing.lg }}>
          <Text
            style={[
              typography.body.md,
              { color: colors.textMuted, textAlign: "center" },
            ]}
          >
            {t("emergency.confirm.body")}
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              marginTop: spacing.md,
            }}
          >
            <Button
              title={t("emergency.confirm.cancel")}
              variant="outline"
              onPress={() => setConfirmOpen(false)}
              fullWidth
            />
            <Button
              title={t("emergency.confirm.send")}
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
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: spacing.md,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 9,
          borderCurve: "continuous",
          backgroundColor: colors.fill,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={16} color={colors.textMuted} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={[typography.caption, { color: colors.textSubtle }]}
        >
          {label}
        </Text>
        <Text
          style={[
            typography.title.xs,
            { color: colors.text, marginTop: 2 },
          ]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}