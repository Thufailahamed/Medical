import React, { useMemo, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import {
  Building2,
  Layers,
  Users,
  Receipt,
  Plus,
  Star,
  ShieldCheck,
  Hospital,
  BadgeCheck,
  Clock,
  Percent,
  Eye,
  Check,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import {
  Screen,
  BottomSheet,
  TextInput,
  Pill,
  Pressable,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { useTone, type Tone } from "@/theme/tone";
import {
  useInsuranceProviders,
  useSaveInsuranceProvider,
  useInsurancePlans,
  useSaveInsurancePlan,
  useInsuranceEnrollments,
  useInsuranceMktClaims,
} from "@/hooks/useAdminApi";
import {
  AdminHero,
  AdminCard,
  AdminSection,
  AdminSegmented,
  AdminEmpty,
  IconTile,
  FilterChips,
  ListSkeleton,
  AdminError,
  StatusPill,
  MetaTag,
  FormGroup,
  FormRow,
  SheetField,
  SheetForm,
  ToggleList,
  relTime,
} from "@/components/admin/ui";
import { fmtDate } from "@/lib/format";
import { useLocaleStore } from "@/stores/locale";

type Section = "providers" | "plans" | "enrollments" | "claims";

const SECTIONS = [
  { label: "Providers", value: "providers" },
  { label: "Plans", value: "plans" },
  { label: "Members", value: "enrollments" },
  { label: "Claims", value: "claims" },
];

const PLAN_TYPES = [
  "individual",
  "family_floater",
  "senior",
  "critical_illness",
  "cancer",
  "dental",
  "maternity",
];

const CLAIM_FILTERS = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending", tone: "warning" as const },
  { label: "Under review", value: "under_review" },
  { label: "Approved", value: "approved", tone: "success" as const },
  { label: "Rejected", value: "rejected", tone: "danger" as const },
  { label: "Paid", value: "paid", tone: "success" as const },
];

const BRAND_TONES: Tone[] = ["primary", "accent", "info", "accent2", "warning"];

const humanize = (v?: string | null) => {
  const s = (v ?? "").replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/** 2500000 → "2.5M", 850000 → "850K". */
function compactLkr(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function AdminInsuranceMktScreen() {
  const { spacing } = useTheme();
  const toast = useToast();
  const [section, setSection] = useState<Section>("providers");
  const [claimStatus, setClaimStatus] = useState("all");
  const [planProvider, setPlanProvider] = useState("");

  const providers = useInsuranceProviders();
  const plans = useInsurancePlans(planProvider || undefined);
  const enrollments = useInsuranceEnrollments();
  const mktClaims = useInsuranceMktClaims(claimStatus);

  const saveProvider = useSaveInsuranceProvider();
  const savePlan = useSaveInsurancePlan();

  const [providerSheet, setProviderSheet] = useState(false);
  const [planSheet, setPlanSheet] = useState(false);
  const [editProvider, setEditProvider] = useState<any | null>(null);
  const [editPlan, setEditPlan] = useState<any | null>(null);

  const providerList = providers.data?.providers ?? [];
  const planList = plans.data?.plans ?? [];
  const enrollmentList = enrollments.data?.enrollments ?? [];
  const claimList = mktClaims.data?.claims ?? [];

  const providerById = useMemo(() => {
    const m: Record<string, any> = {};
    providerList.forEach((p: any) => (m[p.id] = p));
    return m;
  }, [providerList]);
  const planById = useMemo(() => {
    const m: Record<string, any> = {};
    planList.forEach((p: any) => (m[p.id] = p));
    return m;
  }, [planList]);

  const providerOptions = useMemo(
    () => [
      { label: "All providers", value: "" },
      ...providerList.map((p: any) => ({ label: p.name, value: p.id })),
    ],
    [providerList]
  );

  const refetchAll = () => {
    providers.refetch();
    plans.refetch();
    enrollments.refetch();
    mktClaims.refetch();
  };

  const q = {
    providers,
    plans,
    enrollments,
    claims: mktClaims,
  }[section];
  const isRefetching =
    providers.isRefetching ||
    plans.isRefetching ||
    enrollments.isRefetching ||
    mktClaims.isRefetching;

  const openNew = () => {
    if (section === "providers") {
      setEditProvider(null);
      setProviderSheet(true);
    } else {
      setEditPlan(null);
      setPlanSheet(true);
    }
  };

  const sectionMeta: Record<Section, { title: string; count: number }> = {
    providers: { title: "Insurers", count: providerList.length },
    plans: { title: "Plans", count: planList.length },
    enrollments: { title: "Enrollments", count: enrollmentList.length },
    claims: { title: "Claims", count: claimList.length },
  };

  return (
    <Screen
      scroll
      padded={false}
      refreshing={isRefetching}
      onRefresh={refetchAll}
      edges={["top"]}
    >
      <View style={{ paddingTop: spacing.md }}>
        <AdminHero
          compact
          back
          eyebrow="Marketplace"
          title="Insurance"
          subtitle="Insurers, plans, members & claims"
          icon={ShieldCheck}
          stats={[
            { icon: Building2, value: providerList.length, label: "Insurers" },
            { icon: Layers, value: planList.length, label: "Plans" },
            { icon: Users, value: enrollmentList.length, label: "Enrolled" },
          ]}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
        <AdminSegmented
          options={SECTIONS}
          value={section}
          onChange={(v) => setSection(v as Section)}
        />
      </View>

      <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
        <AdminSection
          title={sectionMeta[section].title}
          count={sectionMeta[section].count}
          action={
            section === "providers" || section === "plans" ? (
              <AddPill
                label={section === "providers" ? "Insurer" : "Plan"}
                onPress={openNew}
              />
            ) : undefined
          }
        />
      </View>

      {section === "plans" && providerList.length > 0 ? (
        <View style={{ marginBottom: spacing.md, marginTop: -spacing.xs }}>
          <FilterChips
            options={providerOptions}
            value={planProvider}
            onChange={setPlanProvider}
            size="sm"
          />
        </View>
      ) : null}
      {section === "claims" ? (
        <View style={{ marginBottom: spacing.md, marginTop: -spacing.xs }}>
          <FilterChips
            options={CLAIM_FILTERS}
            value={claimStatus}
            onChange={setClaimStatus}
            size="sm"
          />
        </View>
      ) : null}

      <View
        style={{
          paddingHorizontal: spacing.lg,
          gap: spacing.md,
          paddingBottom: spacing.xxl,
        }}
      >
        {q.isError ? (
          <AdminError
            title="Load failed"
            message="Couldn't load this section."
            onRetry={() => q.refetch()}
            retrying={q.isRefetching}
          />
        ) : q.isLoading ? (
          <ListSkeleton rows={4} />
        ) : section === "providers" ? (
          providerList.length === 0 ? (
            <AdminEmpty
              icon={Building2}
              title="No insurers yet"
              message="Add the first insurance provider to open the marketplace."
              actionLabel="Add insurer"
              onAction={openNew}
            />
          ) : (
            providerList.map((p: any) => (
              <ProviderCard
                key={p.id}
                p={p}
                onPress={() => {
                  setEditProvider(p);
                  setProviderSheet(true);
                }}
              />
            ))
          )
        ) : section === "plans" ? (
          planList.length === 0 ? (
            <AdminEmpty
              icon={Layers}
              title="No plans"
              message={
                planProvider
                  ? "This insurer has no plans yet."
                  : "Add a plan under an insurer."
              }
              actionLabel="Add plan"
              onAction={openNew}
            />
          ) : (
            planList.map((p: any) => (
              <PlanCard
                key={p.id}
                p={p}
                providerName={providerById[p.providerId]?.name}
                onPress={() => {
                  setEditPlan(p);
                  setPlanSheet(true);
                }}
              />
            ))
          )
        ) : section === "enrollments" ? (
          enrollmentList.length === 0 ? (
            <AdminEmpty
              icon={Users}
              title="No enrollments yet"
              message="Patient policy enrollments will appear here."
            />
          ) : (
            enrollmentList.map((e: any) => (
              <EnrollmentCard key={e.id} e={e} plan={planById[e.planId]} />
            ))
          )
        ) : claimList.length === 0 ? (
          <AdminEmpty
            icon={Receipt}
            title={claimStatus === "all" ? "No claims yet" : `No ${humanize(claimStatus).toLowerCase()} claims`}
            message="Marketplace claims will appear here."
          />
        ) : (
          claimList.map((c: any) => <ClaimCard key={c.id} c={c} />)
        )}
      </View>

      <ProviderSheet
        visible={providerSheet}
        provider={editProvider}
        saving={saveProvider.isPending}
        onClose={() => setProviderSheet(false)}
        onSave={(body) =>
          saveProvider.mutate(
            { id: editProvider?.id, body },
            {
              onSuccess: () => {
                toast.show("Provider saved", "success");
                setProviderSheet(false);
              },
              onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
            }
          )
        }
      />
      <PlanSheet
        visible={planSheet}
        plan={editPlan}
        providers={providerList}
        saving={savePlan.isPending}
        onClose={() => setPlanSheet(false)}
        onSave={(body) =>
          savePlan.mutate(
            { id: editPlan?.id, body },
            {
              onSuccess: () => {
                toast.show("Plan saved", "success");
                setPlanSheet(false);
              },
              onError: (e: any) => toast.show(e?.message ?? "Failed", "danger"),
            }
          )
        }
      />
    </Screen>
  );
}

// ─── Small pieces ───────────────────────────────────────────

function AddPill({ label, onPress }: { label: string; onPress: () => void }) {
  const { colors, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="button"
      accessibilityLabel={`Add ${label.toLowerCase()}`}
      hitSlop={6}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        height: 34,
        paddingLeft: 10,
        paddingRight: 14,
        borderRadius: 17,
        backgroundColor: colors.primary,
      }}
    >
      <Plus size={15} color={colors.onPrimary} strokeWidth={2.8} />
      <Text style={[typography.label.sm, { color: colors.onPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Deterministic coloured initials tile for an insurer. */
function BrandTile({ name, size = 48 }: { name: string; size?: number }) {
  const hash = [...(name ?? "")].reduce((a, c) => a + c.charCodeAt(0), 0);
  const { bg, fg } = useTone(BRAND_TONES[hash % BRAND_TONES.length]);
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        borderCurve: "continuous",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
      }}
    >
      <Text style={{ color: fg, fontSize: size * 0.36, fontWeight: "800" }}>
        {initials}
      </Text>
    </View>
  );
}

function PublishPill({ published }: { published: boolean }) {
  return (
    <Pill
      label={published ? "Published" : "Draft"}
      tone={published ? "success" : "neutral"}
      icon={published ? Eye : undefined}
      size="sm"
    />
  );
}

function CardFooter({ children }: { children: React.ReactNode }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.separator,
        backgroundColor: colors.surfaceMuted,
      }}
    >
      {children}
    </View>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
}: {
  icon: LucideIcon;
  value: string;
  label: string;
}) {
  const { colors, typography } = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
        <Icon size={12} color={colors.textSubtle} strokeWidth={2.4} />
        <Text
          style={[typography.caption, { color: colors.textSubtle }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          typography.title.sm,
          { color: colors.text, marginTop: 2, fontVariant: ["tabular-nums"] },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

// ─── Cards ──────────────────────────────────────────────────

function ProviderCard({ p, onPress }: { p: any; onPress: () => void }) {
  const { colors, spacing, typography } = useTheme();
  const ratio = p.claimSettlementRatioPct;
  return (
    <AdminCard onPress={onPress} style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <BrandTile name={p.name} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text
              style={[typography.title.sm, { color: colors.text }]}
              numberOfLines={1}
            >
              {p.name}
            </Text>
            <Text
              style={[typography.caption, { color: colors.textMuted }]}
              numberOfLines={2}
            >
              {p.tagline || p.slug}
            </Text>
          </View>
        </View>
        {ratio != null || p.cashlessHospitalCount != null ? (
          <View
            style={{
              flexDirection: "row",
              gap: spacing.md,
              padding: spacing.md,
              borderRadius: 14,
              borderCurve: "continuous",
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <View style={{ flex: 1.3, minWidth: 0 }}>
              <Metric
                icon={BadgeCheck}
                label="Claims settled"
                value={ratio != null ? `${ratio}%` : "—"}
              />
              {ratio != null ? (
                <View
                  style={{
                    height: 4,
                    borderRadius: 2,
                    marginTop: 6,
                    backgroundColor: colors.fill,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${Math.min(100, Math.max(0, Number(ratio)))}%`,
                      height: "100%",
                      borderRadius: 2,
                      backgroundColor: colors.success,
                    }}
                  />
                </View>
              ) : null}
            </View>
            <Metric
              icon={Hospital}
              label="Cashless hospitals"
              value={
                p.cashlessHospitalCount != null
                  ? Number(p.cashlessHospitalCount).toLocaleString()
                  : "—"
              }
            />
          </View>
        ) : null}
      </View>
      <CardFooter>
        <PublishPill published={!!p.isPublished} />
        <Text
          style={[typography.caption, { color: colors.textSubtle, flex: 1, textAlign: "right" }]}
          numberOfLines={1}
        >
          {p.regulatorLicense ? `Licence ${p.regulatorLicense}` : ""}
        </Text>
      </CardFooter>
    </AdminCard>
  );
}

function PlanCard({
  p,
  providerName,
  onPress,
}: {
  p: any;
  providerName?: string;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <AdminCard onPress={onPress} style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: spacing.md }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {providerName ? (
              <Text
                style={[typography.overline, { color: colors.primary, marginBottom: 3 }]}
                numberOfLines={1}
              >
                {providerName.toUpperCase()}
              </Text>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text
                style={[typography.title.sm, { color: colors.text, flexShrink: 1 }]}
                numberOfLines={1}
              >
                {p.name}
              </Text>
              {p.isFeatured ? (
                <Star size={13} color={colors.warning} fill={colors.warning} />
              ) : null}
            </View>
            <View style={{ flexDirection: "row", marginTop: 6 }}>
              <MetaTag icon={Layers} label={humanize(p.planType)} />
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text
              style={[
                typography.title.md,
                { color: colors.text, fontVariant: ["tabular-nums"] },
              ]}
            >
              LKR {Number(p.monthlyPremiumLkr ?? 0).toLocaleString()}
            </Text>
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              per month
            </Text>
          </View>
        </View>
        <View
          style={{
            flexDirection: "row",
            gap: spacing.md,
            padding: spacing.md,
            borderRadius: 14,
            borderCurve: "continuous",
            backgroundColor: colors.surfaceMuted,
          }}
        >
          <Metric
            icon={ShieldCheck}
            label="Cover"
            value={`LKR ${compactLkr(Number(p.coverageSummaryLkr ?? 0))}`}
          />
          <Metric
            icon={Percent}
            label="Copay"
            value={p.copayPct != null ? `${p.copayPct}%` : "—"}
          />
          <Metric
            icon={Clock}
            label="Waiting"
            value={p.waitingPeriodDays != null ? `${p.waitingPeriodDays}d` : "—"}
          />
        </View>
      </View>
      <CardFooter>
        <PublishPill published={!!p.isPublished} />
        <Text
          style={[typography.caption, { color: colors.textSubtle, flex: 1, textAlign: "right" }]}
          numberOfLines={1}
        >
          {p.annualPremiumLkr
            ? `LKR ${Number(p.annualPremiumLkr).toLocaleString()} / year`
            : ""}
        </Text>
      </CardFooter>
    </AdminCard>
  );
}

function EnrollmentCard({ e, plan }: { e: any; plan?: any }) {
  const { colors, spacing, typography } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const when = e.createdAt
    ? relTime(e.createdAt) || fmtDate(e.createdAt, locale as any)
    : "";
  return (
    <AdminCard>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconTile icon={Users} tone="accent" size={44} />
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text
            style={[typography.title.sm, { color: colors.text, fontVariant: ["tabular-nums"] }]}
            numberOfLines={1}
          >
            {e.policyNumber ?? "Policy pending"}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
            {plan?.name ?? `Plan ${e.planId?.slice(0, 8) ?? "—"}`}
          </Text>
          <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
            Member {e.userId?.slice(0, 8)}{when ? ` · ${when}` : ""}
          </Text>
        </View>
        <StatusPill status={e.status ?? "active"} />
      </View>
    </AdminCard>
  );
}

function ClaimCard({ c }: { c: any }) {
  const { colors, spacing, typography } = useTheme();
  const requested = Number(c.amountRequestedLkr ?? 0);
  const approved = c.amountApprovedLkr != null ? Number(c.amountApprovedLkr) : null;
  return (
    <AdminCard style={{ padding: 0 }}>
      <View style={{ padding: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <IconTile icon={Receipt} tone="warning" size={44} />
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <Text style={[typography.title.sm, { color: colors.text }]} numberOfLines={1}>
              {c.patientName ?? "Patient"}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted }]} numberOfLines={1}>
              {humanize(c.treatmentType) || "Claim"} · {c.providerName ?? "—"}
            </Text>
          </View>
          <StatusPill status={c.status ?? "pending"} />
        </View>
      </View>
      <CardFooter>
        <View style={{ flex: 1 }}>
          <Text style={[typography.caption, { color: colors.textSubtle }]}>Requested</Text>
          <Text style={[typography.label.md, { color: colors.text, fontVariant: ["tabular-nums"] }]}>
            LKR {requested.toLocaleString()}
          </Text>
        </View>
        <View style={{ flex: 1, alignItems: "flex-end" }}>
          <Text style={[typography.caption, { color: colors.textSubtle }]}>Approved</Text>
          <Text
            style={[
              typography.label.md,
              {
                color: approved != null ? colors.success : colors.textSubtle,
                fontVariant: ["tabular-nums"],
              },
            ]}
          >
            {approved != null ? `LKR ${approved.toLocaleString()}` : "—"}
          </Text>
        </View>
      </CardFooter>
    </AdminCard>
  );
}

// ─── Provider create/edit sheet ─────────────────────────────

function ProviderSheet({
  visible,
  provider,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  provider: any | null;
  saving: boolean;
  onClose: () => void;
  onSave: (body: any) => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  const [published, setPublished] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setF({
        operatorOrgId: provider?.operatorOrgId ?? provider?.operator_org_id ?? "",
        name: provider?.name ?? "",
        slug: provider?.slug ?? "",
        tagline: provider?.tagline ?? "",
        description: provider?.description ?? "",
        regulatorLicense:
          provider?.regulatorLicense ?? provider?.regulator_license ?? "",
        claimSettlementRatioPct: String(
          provider?.claimSettlementRatioPct ??
            provider?.claim_settlement_ratio_pct ??
            ""
        ),
        cashlessHospitalCount: String(
          provider?.cashlessHospitalCount ??
            provider?.cashless_hospital_count ??
            ""
        ),
        websiteUrl: provider?.websiteUrl ?? provider?.website_url ?? "",
        supportPhone: provider?.supportPhone ?? provider?.support_phone ?? "",
      });
      setPublished(!!(provider?.isPublished ?? provider?.is_published));
    }
  }, [visible, provider]);

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const valid = f.name?.trim() && f.slug?.trim() && (provider || f.operatorOrgId?.trim());

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onClose}
      title={provider ? "Edit insurer" : "New insurer"}
      height={700}
    >
      <SheetForm
        submitLabel={provider ? "Save changes" : "Create insurer"}
        onCancel={onClose}
        loading={saving}
        disabled={!valid}
        onSubmit={() =>
          onSave({
            ...(provider ? {} : { operatorOrgId: f.operatorOrgId.trim() }),
            name: f.name.trim(),
            slug: f.slug.trim(),
            tagline: f.tagline.trim() || undefined,
            description: f.description.trim() || undefined,
            regulatorLicense: f.regulatorLicense.trim() || undefined,
            claimSettlementRatioPct: num(f.claimSettlementRatioPct),
            cashlessHospitalCount: num(f.cashlessHospitalCount),
            websiteUrl: f.websiteUrl.trim() || undefined,
            supportPhone: f.supportPhone.trim() || undefined,
            isPublished: published,
          })
        }
      >
        <FormGroup title="Identity">
          {!provider ? (
            <SheetField label="Operator org ID" required>
              <TextInput
                value={f.operatorOrgId}
                onChangeText={set("operatorOrgId")}
                placeholder="Created if missing"
                autoCapitalize="none"
              />
            </SheetField>
          ) : null}
          <SheetField label="Name" required>
            <TextInput value={f.name} onChangeText={set("name")} placeholder="e.g. Ceylinco Insurance" />
          </SheetField>
          <SheetField label="Slug" required hint="lowercase-and-dashes">
            <TextInput
              value={f.slug}
              onChangeText={set("slug")}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="ceylinco-insurance"
            />
          </SheetField>
          <SheetField label="Tagline">
            <TextInput value={f.tagline} onChangeText={set("tagline")} placeholder="One-line pitch" />
          </SheetField>
          <SheetField label="Description">
            <TextInput
              value={f.description}
              onChangeText={set("description")}
              multiline
              numberOfLines={3}
              style={{ minHeight: 76, textAlignVertical: "top" }}
            />
          </SheetField>
        </FormGroup>

        <FormGroup title="Credentials">
          <SheetField label="Regulator licence">
            <TextInput
              value={f.regulatorLicense}
              onChangeText={set("regulatorLicense")}
              autoCapitalize="characters"
              placeholder="IRSL/INS/000"
            />
          </SheetField>
          <FormRow>
            <SheetField label="Claims settled %">
              <TextInput
                value={f.claimSettlementRatioPct}
                onChangeText={set("claimSettlementRatioPct")}
                keyboardType="numeric"
                placeholder="0–100"
              />
            </SheetField>
            <SheetField label="Cashless hospitals">
              <TextInput
                value={f.cashlessHospitalCount}
                onChangeText={set("cashlessHospitalCount")}
                keyboardType="numeric"
              />
            </SheetField>
          </FormRow>
        </FormGroup>

        <FormGroup title="Contact">
          <SheetField label="Website">
            <TextInput
              value={f.websiteUrl}
              onChangeText={set("websiteUrl")}
              autoCapitalize="none"
              keyboardType="url"
              placeholder="https://…"
            />
          </SheetField>
          <SheetField label="Support phone">
            <TextInput
              value={f.supportPhone}
              onChangeText={set("supportPhone")}
              keyboardType="phone-pad"
              placeholder="+94…"
            />
          </SheetField>
        </FormGroup>

        <FormGroup title="Visibility">
          <ToggleList
            items={[
              {
                key: "published",
                label: "Published",
                hint: "Visible to patients in the marketplace",
                icon: Eye,
                value: published,
                onChange: setPublished,
              },
            ]}
          />
        </FormGroup>
      </SheetForm>
    </BottomSheet>
  );
}

// ─── Plan create/edit sheet ─────────────────────────────────

function PlanSheet({
  visible,
  plan,
  providers,
  saving,
  onClose,
  onSave,
}: {
  visible: boolean;
  plan: any | null;
  providers: any[];
  saving: boolean;
  onClose: () => void;
  onSave: (body: any) => void;
}) {
  const { spacing } = useTheme();
  const [f, setF] = useState<Record<string, string>>({});
  const [published, setPublished] = useState(false);
  const [featured, setFeatured] = useState(false);

  React.useEffect(() => {
    if (visible) {
      setF({
        providerId: plan?.providerId ?? plan?.provider_id ?? "",
        name: plan?.name ?? "",
        slug: plan?.slug ?? "",
        planType: plan?.planType ?? plan?.plan_type ?? "individual",
        coverageSummaryLkr: String(
          plan?.coverageSummaryLkr ?? plan?.coverage_summary_lkr ?? ""
        ),
        monthlyPremiumLkr: String(
          plan?.monthlyPremiumLkr ?? plan?.monthly_premium_lkr ?? ""
        ),
        annualPremiumLkr: String(
          plan?.annualPremiumLkr ?? plan?.annual_premium_lkr ?? ""
        ),
        deductibleLkr: String(
          plan?.deductibleLkr ?? plan?.deductible_lkr ?? "0"
        ),
        copayPct: String(plan?.copayPct ?? plan?.copay_pct ?? "10"),
        waitingPeriodDays: String(
          plan?.waitingPeriodDays ?? plan?.waiting_period_days ?? "30"
        ),
        termMonths: String(plan?.termMonths ?? plan?.term_months ?? "12"),
      });
      setPublished(!!(plan?.isPublished ?? plan?.is_published));
      setFeatured(!!(plan?.isFeatured ?? plan?.is_featured));
    }
  }, [visible, plan]);

  const set = (k: string) => (v: string) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? undefined : Number(v));

  const valid =
    f.providerId &&
    f.name?.trim() &&
    f.slug?.trim() &&
    Number(f.coverageSummaryLkr) > 0 &&
    Number(f.monthlyPremiumLkr) > 0 &&
    Number(f.annualPremiumLkr) > 0;

  return (
    <BottomSheet
      visible={visible}
      onDismiss={onClose}
      title={plan ? "Edit plan" : "New plan"}
      height={700}
    >
      <SheetForm
        submitLabel={plan ? "Save changes" : "Create plan"}
        onCancel={onClose}
        loading={saving}
        disabled={!valid}
        onSubmit={() =>
          onSave({
            providerId: f.providerId,
            name: f.name.trim(),
            slug: f.slug.trim(),
            planType: f.planType,
            coverageSummaryLkr: num(f.coverageSummaryLkr),
            monthlyPremiumLkr: num(f.monthlyPremiumLkr),
            annualPremiumLkr: num(f.annualPremiumLkr),
            deductibleLkr: num(f.deductibleLkr),
            copayPct: num(f.copayPct),
            waitingPeriodDays: num(f.waitingPeriodDays),
            termMonths: num(f.termMonths),
            isPublished: published,
            isFeatured: featured,
          })
        }
      >
        <FormGroup title="Insurer">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {providers.map((p: any) => (
              <ProviderOption
                key={p.id}
                name={p.name}
                selected={f.providerId === p.id}
                onPress={() => set("providerId")(p.id)}
              />
            ))}
          </ScrollView>
        </FormGroup>

        <FormGroup title="Plan">
          <SheetField label="Name" required>
            <TextInput value={f.name} onChangeText={set("name")} placeholder="e.g. Health Individual" />
          </SheetField>
          <SheetField label="Slug" required>
            <TextInput
              value={f.slug}
              onChangeText={set("slug")}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </SheetField>
          <SheetField label="Plan type" required>
            <FilterChips
              options={PLAN_TYPES.map((t) => ({ label: humanize(t), value: t }))}
              value={f.planType}
              onChange={set("planType")}
              size="sm"
              flush
            />
          </SheetField>
        </FormGroup>

        <FormGroup title="Pricing (LKR)">
          <FormRow>
            <SheetField label="Monthly premium" required>
              <TextInput
                value={f.monthlyPremiumLkr}
                onChangeText={set("monthlyPremiumLkr")}
                keyboardType="numeric"
              />
            </SheetField>
            <SheetField label="Annual premium" required>
              <TextInput
                value={f.annualPremiumLkr}
                onChangeText={set("annualPremiumLkr")}
                keyboardType="numeric"
              />
            </SheetField>
          </FormRow>
          <FormRow>
            <SheetField label="Coverage" required>
              <TextInput
                value={f.coverageSummaryLkr}
                onChangeText={set("coverageSummaryLkr")}
                keyboardType="numeric"
              />
            </SheetField>
            <SheetField label="Deductible">
              <TextInput
                value={f.deductibleLkr}
                onChangeText={set("deductibleLkr")}
                keyboardType="numeric"
              />
            </SheetField>
          </FormRow>
        </FormGroup>

        <FormGroup title="Terms">
          <FormRow>
            <SheetField label="Copay %">
              <TextInput value={f.copayPct} onChangeText={set("copayPct")} keyboardType="numeric" />
            </SheetField>
            <SheetField label="Waiting days">
              <TextInput
                value={f.waitingPeriodDays}
                onChangeText={set("waitingPeriodDays")}
                keyboardType="numeric"
              />
            </SheetField>
            <SheetField label="Term (mo)">
              <TextInput value={f.termMonths} onChangeText={set("termMonths")} keyboardType="numeric" />
            </SheetField>
          </FormRow>
        </FormGroup>

        <FormGroup title="Visibility">
          <ToggleList
            items={[
              {
                key: "published",
                label: "Published",
                hint: "Patients can browse and enrol",
                icon: Eye,
                value: published,
                onChange: setPublished,
              },
              {
                key: "featured",
                label: "Featured",
                hint: "Highlight at the top of the marketplace",
                icon: Star,
                value: featured,
                onChange: setFeatured,
              },
            ]}
          />
        </FormGroup>
      </SheetForm>
    </BottomSheet>
  );
}

function ProviderOption({
  name,
  selected,
  onPress,
}: {
  name: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, spacing, typography } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      haptic="light"
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={name}
      style={{
        width: 116,
        padding: spacing.md,
        gap: spacing.sm,
        borderRadius: 18,
        borderCurve: "continuous",
        borderWidth: selected ? 2 : StyleSheet.hairlineWidth * 2,
        borderColor: selected ? colors.primary : colors.hairline,
        backgroundColor: selected ? colors.primarySoft : colors.surface,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <BrandTile name={name} size={36} />
        {selected ? (
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.primary,
            }}
          >
            <Check size={12} color={colors.onPrimary} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text
        style={[typography.label.sm, { color: colors.text }]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </Pressable>
  );
}
