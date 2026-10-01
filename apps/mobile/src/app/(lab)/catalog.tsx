// @ts-nocheck
// Lab catalog + packages: list with add/edit sheets.
// (Delete omitted — available server-side; flagged for a later pass.)

import { useState } from "react";
import { View, Text, ScrollView, RefreshControl } from "react-native";
import { useTranslation } from "react-i18next";
import { FlaskConical, Package, Plus, Pencil } from "lucide-react-native";
import {
  useLabCatalog,
  useLabPackages,
  useLabSaveTest,
  useLabSavePackage,
} from "@/hooks/useApi";
import { useTheme } from "@/theme/ThemeProvider";
import {
  Screen,
  ScreenHeader,
  Card,
  Button,
  EmptyState,
  ErrorState,
  Skeleton,
  TextInput,
  BottomSheet,
  FormField,
  SectionHeader,
  useToast,
  IconTile,
} from "@/components/ui";

export default function LabCatalogScreen() {
  const { t } = useTranslation();
  const { spacing, colors, typography } = useTheme();
  const toast = useToast();

  const tests = useLabCatalog();
  const packages = useLabPackages();
  const saveTest = useLabSaveTest();
  const savePackage = useLabSavePackage();

  const [testSheet, setTestSheet] = useState<null | { mode: "add" | "edit"; item?: any }>(null);
  const [pkgSheet, setPkgSheet] = useState<null | { mode: "add" | "edit"; item?: any }>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  function openTest(mode: "add" | "edit", item?: any) {
    setName(item?.name ?? "");
    setCategory(item?.category ?? "");
    setPrice(item?.price != null ? String(item.price) : "");
    setDescription(item?.description ?? "");
    setTestSheet({ mode, item });
  }

  function openPkg(mode: "add" | "edit", item?: any) {
    setName(item?.name ?? "");
    setPrice(item?.price != null ? String(item.price) : "");
    setDescription(item?.description ?? "");
    setPkgSheet({ mode, item });
  }

  async function onSaveTest() {
    const amount = Number(price);
    if (!name.trim() || !Number.isFinite(amount) || amount < 0) {
      toast.show(t("common.error"), "danger");
      return;
    }
    try {
      await saveTest.mutateAsync({
        ...(testSheet?.item?.id ? { id: testSheet.item.id } : {}),
        name: name.trim(),
        category: category.trim() || "general",
        description: description.trim() || undefined,
        price: amount,
      });
      setTestSheet(null);
      toast.show(t("lab.saved"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  async function onSavePkg() {
    const amount = Number(price);
    if (!name.trim() || !Number.isFinite(amount) || amount < 0) {
      toast.show(t("common.error"), "danger");
      return;
    }
    try {
      await savePackage.mutateAsync({
        ...(pkgSheet?.item?.id ? { id: pkgSheet.item.id } : {}),
        name: name.trim(),
        description: description.trim() || undefined,
        price: amount,
      });
      setPkgSheet(null);
      toast.show(t("lab.saved"), "success");
    } catch (e: any) {
      toast.show(e?.message || t("common.error"), "danger");
    }
  }

  const testRows: any[] = tests.data?.tests ?? [];
  const pkgRows: any[] = packages.data?.packages ?? [];
  const loading = tests.isLoading || packages.isLoading;
  const error = tests.isError || packages.isError;

  return (
    <Screen padded={false} edges={["top"]} bottomInset={false}>
      <ScreenHeader
        title={t("lab.catalogTitle")}
        subtitle={t("lab.catalogSubtitle")}
        kicker="LABORATORY"
      />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: 120,
          gap: spacing.lg,
        }}
        refreshControl={
          <RefreshControl
            refreshing={(tests.isFetching && !tests.isLoading) || (packages.isFetching && !packages.isLoading)}
            onRefresh={() => { tests.refetch(); packages.refetch(); }}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <Skeleton height={160} radius={20} />
        ) : error ? (
          <ErrorState onRetry={() => { tests.refetch(); packages.refetch(); }} />
        ) : (
          <>
            <View style={{ gap: spacing.sm }}>
              <SectionHeader
                title={t("lab.catalogTitle")}
                actionLabel={t("lab.addTest")}
                onAction={() => openTest("add")}
              />
              {testRows.length === 0 ? (
                <EmptyState icon={FlaskConical} title={t("lab.empty")} />
              ) : testRows.map((item: any, i: number) => (
                <Card key={item.id ?? i} style={{ padding: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <IconTile icon={FlaskConical} tone="primary" />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {t("lab.price", { amount: Number(item.price ?? 0).toLocaleString() })}
                        {item.category ? ` · ${item.category}` : ""}
                      </Text>
                    </View>
                    <Button title="" icon={Pencil} size="sm" variant="secondary" onPress={() => openTest("edit", item)} />
                  </View>
                </Card>
              ))}
            </View>

            <View style={{ gap: spacing.sm }}>
              <SectionHeader
                title={t("lab.packagesTitle")}
                actionLabel={t("lab.addPackage")}
                onAction={() => openPkg("add")}
              />
              {pkgRows.length === 0 ? (
                <EmptyState icon={Package} title={t("lab.empty")} />
              ) : pkgRows.map((item: any, i: number) => (
                <Card key={item.id ?? i} style={{ padding: spacing.md }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <IconTile icon={Package} tone="accent" />
                    <View style={{ flex: 1 }}>
                      <Text style={[typography.body.md, { color: colors.text, fontWeight: "700" }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textMuted }]}>
                        {t("lab.price", { amount: Number(item.price ?? 0).toLocaleString() })}
                        {item.testCount != null ? ` · ${item.testCount} tests` : ""}
                      </Text>
                    </View>
                    <Button title="" icon={Pencil} size="sm" variant="secondary" onPress={() => openPkg("edit", item)} />
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* Test add/edit sheet */}
      <BottomSheet
        visible={!!testSheet}
        onDismiss={() => setTestSheet(null)}
        title={testSheet?.mode === "edit" ? t("lab.editTest") : t("lab.addTest")}
      >
        <View style={{ gap: spacing.md }}>
          <FormField label={t("lab.name")}>
            <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label={t("lab.category")}>
            <TextInput value={category} onChangeText={setCategory} placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label={t("lab.price", { amount: "–" })}>
            <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label={t("lab.description")}>
            <TextInput value={description} onChangeText={setDescription} placeholderTextColor={colors.textSubtle} multiline />
          </FormField>
          <Button title={t("lab.save")} icon={Plus} size="lg" onPress={onSaveTest} loading={saveTest.isPending} disabled={saveTest.isPending} />
        </View>
      </BottomSheet>

      {/* Package add/edit sheet */}
      <BottomSheet
        visible={!!pkgSheet}
        onDismiss={() => setPkgSheet(null)}
        title={pkgSheet?.mode === "edit" ? t("lab.editPackage") : t("lab.addPackage")}
      >
        <View style={{ gap: spacing.md }}>
          <FormField label={t("lab.name")}>
            <TextInput value={name} onChangeText={setName} placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label={t("lab.price", { amount: "–" })}>
            <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" placeholderTextColor={colors.textSubtle} />
          </FormField>
          <FormField label={t("lab.description")}>
            <TextInput value={description} onChangeText={setDescription} placeholderTextColor={colors.textSubtle} multiline />
          </FormField>
          <Button title={t("lab.save")} icon={Plus} size="lg" onPress={onSavePkg} loading={savePackage.isPending} disabled={savePackage.isPending} />
        </View>
      </BottomSheet>
    </Screen>
  );
}
