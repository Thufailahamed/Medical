import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Lock, Save, KeyRound } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useChangePassword } from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  FormField,
  TextInput,
  Button,
  useToast,
} from "@/components/ui";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { spacing } = useTheme();
  const toast = useToast();
  const changePw = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  async function save() {
    if (next.length < 8) {
      toast.show(t("changePassword.error.tooShort"), "warning");
      return;
    }
    if (next !== confirm) {
      toast.show(t("changePassword.error.mismatch"), "warning");
      return;
    }
    try {
      await changePw.mutateAsync({
        currentPassword: current,
        newPassword: next,
      });
      toast.show(t("changePassword.toast.success"), "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || t("changePassword.toast.error"), "danger");
    }
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title={t("changePassword.title")} />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <FormField label={t("changePassword.field.currentLabel")} required>
          <TextInput
            value={current}
            onChangeText={setCurrent}
            placeholder={t("changePassword.field.currentPlaceholder")}
            secureTextEntry
            leadingIcon={Lock}
          />
        </FormField>
        <FormField label={t("changePassword.field.newLabel")} required>
          <TextInput
            value={next}
            onChangeText={setNext}
            placeholder={t("changePassword.field.newPlaceholder")}
            secureTextEntry
            leadingIcon={KeyRound}
          />
        </FormField>
        <FormField label={t("changePassword.field.confirmLabel")} required>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder={t("changePassword.field.confirmPlaceholder")}
            secureTextEntry
          />
        </FormField>
        <Button
          title={t("changePassword.action.submit")}
          onPress={save}
          loading={changePw.isPending}
          icon={Save}
          size="lg"
          fullWidth
        />
      </View>
    </Screen>
  );
}