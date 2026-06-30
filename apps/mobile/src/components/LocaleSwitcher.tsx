import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { useLocaleStore, type Locale } from "@/stores/locale";
import { useTheme } from "@/theme/ThemeProvider";
import { Pill } from "@/components/ui";
import { api } from "@/lib/api";

const LOCALES: Array<{ code: Locale; labelKey: string; nativeName: string }> = [
  { code: "en", labelKey: "common.languageEnglish", nativeName: "English" },
  { code: "si", labelKey: "common.languageSinhala", nativeName: "සිංහල" },
  { code: "ta", labelKey: "common.languageTamil", nativeName: "தமிழ்" },
];

// 3-option segmented selector for app locale. Shows native script (e.g. සිංහල)
// so users can identify their language without needing the Latin label.
// Active option uses primary tone; others use neutral.
export function LocaleSwitcher() {
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  // Persist locally for instant i18n, then sync to server so future
  // server-side pushes (vaccination cron, etc.) use the same locale.
  // Best-effort: if the network call fails, the local change still sticks.
  const onSelect = (code: Locale) => {
    setLocale(code);
    api("/me/locale", { method: "PATCH", body: { locale: code } }).catch(
      (err) => console.warn("[locale] PATCH /me/locale failed:", err?.message)
    );
  };

  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing.sm,
        paddingVertical: spacing.sm,
      }}
    >
      {LOCALES.map((l) => {
        const active = locale === l.code;
        return (
          <Pill
            key={l.code}
            label={t(l.labelKey, { defaultValue: l.nativeName })}
            tone={active ? "primary" : "neutral"}
            outlined={!active}
            onPress={() => onSelect(l.code)}
            style={{ minHeight: 36, paddingVertical: 6 }}
          />
        );
      })}
    </View>
  );
}