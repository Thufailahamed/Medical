import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Lock, Save, KeyRound } from "lucide-react-native";
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
  const { spacing } = useTheme();
  const toast = useToast();
  const changePw = useChangePassword();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  async function save() {
    if (next.length < 8) {
      toast.show("New password must be at least 8 characters", "warning");
      return;
    }
    if (next !== confirm) {
      toast.show("Passwords don't match", "warning");
      return;
    }
    try {
      await changePw.mutateAsync({
        currentPassword: current,
        newPassword: next,
      });
      toast.show("Password updated", "success");
      router.back();
    } catch (err: any) {
      toast.show(err?.message || "Could not change password", "danger");
    }
  }

  return (
    <Screen scroll keyboard padded={false} edges={["top"]} bottomInset>
      <ScreenHeader back title="Change password" />
      <View style={{ padding: spacing.lg, gap: spacing.lg }}>
        <FormField label="Current password" required>
          <TextInput
            value={current}
            onChangeText={setCurrent}
            placeholder="••••••••"
            secureTextEntry
            leadingIcon={Lock}
          />
        </FormField>
        <FormField label="New password" required>
          <TextInput
            value={next}
            onChangeText={setNext}
            placeholder="At least 8 characters"
            secureTextEntry
            leadingIcon={KeyRound}
          />
        </FormField>
        <FormField label="Confirm new password" required>
          <TextInput
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat new password"
            secureTextEntry
          />
        </FormField>
        <Button
          title="Update password"
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