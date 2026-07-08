// Hospital screens are no longer implemented on mobile — the hospital
// portal is web-only (`/hospital/*` under apps/marketing). This screen is
// the deep-link landing for any incoming notification, so we keep the
// route registered and show a CTA that opens the right page on the web.
//
// The `path` prop is the destination under /hospital/* on the marketing
// app (e.g. "/hospital/dashboard", "/hospital/ipd/abc123").

import { useCallback } from "react";
import { Linking, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ExternalLink, Hospital as HospitalIcon } from "lucide-react-native";

import { Screen } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";

export interface HospitalWebRedirectProps {
  /** Path under the marketing app, e.g. `/hospital/ipd/abc123`. */
  path: string;
}

const WEB_BASE_URL =
  process.env.EXPO_PUBLIC_WEB_URL ?? "http://localhost:3000";

export function HospitalWebRedirect({ path }: HospitalWebRedirectProps) {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();

  const url = `${WEB_BASE_URL}${path}`;

  const open = useCallback(() => {
    void Linking.openURL(url);
  }, [url]);

  return (
    <Screen padded>
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.lg,
          paddingVertical: spacing.xl,
        }}
      >
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            backgroundColor: colors.primarySoft,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <HospitalIcon size={36} color={colors.primary} strokeWidth={2.1} />
        </View>

        <View style={{ alignItems: "center", gap: spacing.sm }}>
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <View
              style={[
                typography.title.md,
                { color: colors.text, textAlign: "center" },
              ]}
            >
              {t("hospitalRedirect.title")}
            </View>
            <View
              style={[
                typography.body.sm,
                {
                  color: colors.textMuted,
                  textAlign: "center",
                  maxWidth: 320,
                },
              ]}
            >
              {t("hospitalRedirect.body")}
            </View>
          </View>
        </View>

        <View
          accessibilityRole="button"
          accessibilityLabel={t("hospitalRedirect.openA11y", { url })}
          onAccessibilityTap={open}
          onTouchEnd={open}
          style={{
            marginTop: spacing.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
            borderRadius: 14,
            backgroundColor: colors.primary,
            flexDirection: "row",
            alignItems: "center",
            gap: spacing.sm,
          }}
        >
          <ExternalLink size={18} color="#fff" strokeWidth={2.2} />
          <View style={[typography.title.sm, { color: "#fff" }]}>
            {t("hospitalRedirect.openCta")}
          </View>
        </View>
      </View>
    </Screen>
  );
}