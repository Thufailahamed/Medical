# Slice 2: Pharmacist Dispense Queue — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `(pharmacist)` mobile group with dispense queue, prescription detail (dispense/reject), and QR scan — web parity for `portal/(portal)/pharmacy/` + `pharmacy/[id]` + `scan/` (dispense purpose).

**Architecture:** New hooks in `useApi.ts` talking to `/pharmacy/*` (role-gated `pharmacy`; backend already ships it). New `(pharmacist)/` expo-router group with `IslandTabBar` (Queue + Scan tabs, detail hidden). QR via `react-native-vision-camera@4.7.3` (already in package.json, unused); payload is JSON `{t, p}` resolved by `POST /portal/scan/resolve`. Role `pharmacy` wired into `homeForRole`/`groupForRole` + register; backend `/auth/register` already accepts it (`validators.ts:110-119`).

**Tech Stack:** Expo SDK 52, RN 0.76, expo-router, TanStack Query v5, react-native-vision-camera 4.7.3, existing `@/components/ui` primitives.

## Global Constraints

- Tokens via `useTheme()`; no hardcoded brand colors; `shadow.*` only (no CSS `boxShadow`); `colors.hairline` edges.
- i18n via targeted text insert into `src/i18n/locales/{en,si,ta}.json` — never whole-file round-trip.
- New screens start with `// @ts-nocheck` line 1 (sibling convention).
- Hidden screens registered with `href: null, tabBarStyle: { display: "none" }`.
- Verification: `cd apps/mobile && npx tsc --noEmit | grep -v TS2786`, compare touched files only.
- Camera screens need a dev build (vision-camera doesn't run in Expo Go) — always ship a manual-entry fallback.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/mobile/src/hooks/useApi.ts` (append section) | 5 pharmacy hooks (Task 1) |
| `apps/mobile/src/app/(pharmacist)/_layout.tsx` (create) | Tab group: Queue + Scan tabs (Task 2) |
| `apps/mobile/src/app/(pharmacist)/index.tsx` (create) | Dispense queue w/ status filters + patient filter (Task 2) |
| `apps/mobile/src/app/(pharmacist)/prescription-detail.tsx` (create) | Rx detail + Dispense/Reject (Task 2) |
| `apps/mobile/src/app/(pharmacist)/scan.tsx` (create) | QR scan + manual token entry (Task 2) |
| `apps/mobile/src/hooks/useProtectedRoute.ts` (modify) | `pharmacy` → `/(pharmacist)` (Task 3) |
| `apps/mobile/src/app/(auth)/register.tsx` (modify) | Add `pharmacy` role (Task 3) |
| `apps/mobile/app.config.js` (modify) | vision-camera plugin (Task 3) |
| `src/i18n/locales/{en,si,ta}.json` (modify) | `pharmacy.*` + `nav.tabs.*` keys (Tasks 2–3) |

---

### Task 1: Pharmacy hooks

**Files:**
- Modify: `apps/mobile/src/hooks/useApi.ts` (append new section at end of file)

**Interfaces:**
- Consumes: `api` from `@/lib/api` (supports `{ method, body, headers }` — lib/api.ts:32/47-49; custom headers merged verbatim).
- Produces: `usePharmacyPrescriptions`, `usePharmacyPrescription`, `usePharmacyDispense`, `usePharmacyReject`, `useResolveScanToken` (names/signatures below; Task 2 imports them).

- [ ] **Step 1: Append hooks**
  Append (copy `useQuery`/`useMutation`/`useQueryClient` import style from file top — they are already imported):
  ```ts
  // ─── Pharmacy dispense queue ────────────────────────────────
  export type PharmacyRxFilter = "signed" | "dispensed" | "cancelled" | "all";

  export function usePharmacyPrescriptions(opts: {
    status?: PharmacyRxFilter;
    patientId?: string | null;
  }) {
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (opts?.status && opts.status !== "all") params.set("status", opts.status);
    // Backend reads the patient filter as `patient`, NOT `patientId`
    // (apps/api/src/routes/pharmacy.ts list route).
    if (opts?.patientId) params.set("patient", opts.patientId);
    const qs = params.toString();
    return useQuery({
      queryKey: ["pharmacy", "prescriptions", opts?.status || "signed", opts?.patientId || ""],
      queryFn: () => api<{ prescriptions: any[]; count: number }>(`/pharmacy/prescriptions?${qs}`),
      staleTime: 15_000,
    });
  }

  export function usePharmacyPrescription(id: string | undefined) {
    return useQuery({
      queryKey: ["pharmacy", "prescription", id],
      queryFn: () => api<{ prescription: any }>(`/pharmacy/prescriptions/${id}`),
      enabled: !!id,
      staleTime: 15_000,
    });
  }

  export function usePharmacyDispense() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, dispenseToken }: { id: string; dispenseToken: string | null | undefined }) => {
        // Backend 400s without the single-use token (migration 0059).
        // NULL token = legacy pre-0059 Rx → surface re-issue message, never POST.
        if (!dispenseToken) throw new Error("TOKEN_MISSING");
        return api<{ ok: true; prescriptionId: string; status: string; dispensedAt: string }>(
          `/pharmacy/prescriptions/${id}/dispense`,
          { method: "POST", body: {}, headers: { "x-dispense-token": dispenseToken } },
        );
      },
      onSuccess: (_res, { id }) => {
        qc.invalidateQueries({ queryKey: ["pharmacy", "prescriptions"] });
        qc.invalidateQueries({ queryKey: ["pharmacy", "prescription", id] });
      },
    });
  }

  export function usePharmacyReject() {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
        api<{ ok: true }>(`/pharmacy/prescriptions/${id}/reject`, {
          method: "POST",
          body: { reason },
        }),
      onSuccess: (_res, { id }) => {
        qc.invalidateQueries({ queryKey: ["pharmacy", "prescriptions"] });
        qc.invalidateQueries({ queryKey: ["pharmacy", "prescription", id] });
      },
    });
  }

  export function useResolveScanToken() {
    return useMutation({
      // QR encodes JSON { t: token, p: purpose }. Server resolves it to
      // { purpose, patient: { id, ... } } (web: scan/_components/QrScanner.tsx).
      mutationFn: ({ token, purpose }: { token: string; purpose: string }) =>
        api<{ purpose: string; patient: { id: string; name?: string | null } }>("/portal/scan/resolve", {
          method: "POST",
          body: { token, purpose },
        }),
    });
  }
  ```

- [ ] **Step 2: Verify**
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep "hooks/useApi" || echo CLEAN`
  Expected: `CLEAN`.

- [ ] **Step 3: Commit**
  ```bash
  git add apps/mobile/src/hooks/useApi.ts
  git commit -m "feat(mobile): pharmacy dispense-queue API hooks"
  ```

---

### Task 2: (pharmacist) group screens

**Files:**
- Create: `apps/mobile/src/app/(pharmacist)/_layout.tsx`
- Create: `apps/mobile/src/app/(pharmacist)/index.tsx`
- Create: `apps/mobile/src/app/(pharmacist)/prescription-detail.tsx`
- Create: `apps/mobile/src/app/(pharmacist)/scan.tsx`
- Modify: `src/i18n/locales/{en,si,ta}.json` (targeted inserts)

**Interfaces:**
- Consumes: Task 1 hooks; `IslandTabBar` + `useFloatingTabBarOptions` from `@/components/ui/FloatingTabBar`; `TabIcon` from `@/components/ui`.
- Produces: routes `/(pharmacist)` (queue), `/(pharmacist)/prescription-detail?id=<rxId>[&patient=<id>]`, `/(pharmacist)/scan`.

- [ ] **Step 1: _layout + i18n keys**
  Copy `(doctor)/_layout.tsx` structure (imports, `NARROW_TAB_LABEL`/`WIDE_TAB_LABEL`, `useRealtime()`), with 2 tabs: `index` (icon `Pill`, title `t("nav.tabs.pharmacistQueue")`) and `scan` (icon `ScanLine`, title `t("nav.tabs.pharmacistScan")`); hidden `prescription-detail` (`href: null`). Omit inbox badge logic (no pharmacist inbox). Insert keys (en shown; si/ta English fallback consistent with Slice 1):
  ```json
  "nav": { "tabs": { "pharmacistQueue": "Queue", "pharmacistScan": "Scan" } },
  "pharmacy": {
    "queueTitle": "Dispense queue", "queueSubtitle": "Signed prescriptions awaiting dispense",
    "filters": { "signed": "Awaiting", "dispensed": "Dispensed", "cancelled": "Rejected", "all": "All" },
    "empty": "No prescriptions in this state",
    "patientFilter": "Showing prescriptions for one patient",
    "clearFilter": "Clear",
    "detailTitle": "Prescription", "medicines": "Medicines",
    "dispense": "Dispense", "reject": "Reject", "rejectReason": "Reason (optional)",
    "rejectPlaceholder": "e.g. Out of stock — restocking Friday",
    "dispensed": "Dispensed successfully", "rejected": "Prescription rejected",
    "tokenMissing": "Dispense token missing — this prescription was signed before redemption tokens were required. Ask the doctor to re-issue it.",
    "scanTitle": "Scan patient QR", "scanSubtitle": "Point the camera at the patient's QR code",
    "scanHint": "The QR encodes a single-use token the server resolves to the patient.",
    "manualTitle": "Or enter details manually",
    "tokenPlaceholder": "Paste QR token…", "patientPlaceholder": "Patient ID…",
    "resolve": "Find prescriptions", "noCamera": "Camera unavailable on this device — enter details manually.",
    "requestCamera": "Enable camera", "resolved": "Patient found — showing their prescriptions"
  }
  ```
  Note: check existing `nav.tabs` shape in en.json first — if `nav.tabs` is flat keys (`nav.tabs.doctorHome`), insert the two keys there instead of nesting.

- [ ] **Step 2: Queue (`index.tsx`)**
  `// @ts-nocheck` line 1. Read optional `patient` via `useLocalSearchParams`; `usePharmacyPrescriptions({ status: filter, patientId: patient ?? null })`; filter chips signed(default)/dispensed/cancelled/all; patient banner (when `patient` set) with Clear → `router.setParams({ patient: undefined })`. Rows: patient name, medicineCount, signed date (`fmtDate`), status chip; tap → `router.push("/(doctor)/…")` NO — push `/(pharmacist)/prescription-detail?id=${row.id}`. Skeleton/error/empty states per consents.tsx pattern. Pull-to-refresh via `RefreshControl` + `refetch()`.

- [ ] **Step 3: Detail (`prescription-detail.tsx`)**
  Mirror `(doctor)/prescription-detail.tsx` layout (header → patient/meta card → medicines card → actions), minus Sign (pharmacist can't sign). Read `id` (+ optional `patient`) from params; `usePharmacyPrescription(id)`. Actions on `status === "signed"` only: Dispense → `dispense.mutateAsync({ id, dispenseToken: rx.dispenseToken })`, catch `TOKEN_MISSING` → toast `pharmacy.tokenMissing`; Reject → BottomSheet with reason input → `reject.mutateAsync({ id, reason })`. After either: toast + `router.back()`. Non-signed: show status chip only.

- [ ] **Step 4: Scan (`scan.tsx`)**
  Imports: `import { Camera, useCameraDevice, useCameraPermission, useCodeScanner } from "react-native-vision-camera"` (v4 API verified in node_modules: `useCameraDevice(position)`, `useCameraPermission() → {hasPermission, requestPermission}`, `useCodeScanner({codeTypes, onCodeScanned})`; `Code.value` holds decoded string).
  ```tsx
  const device = useCameraDevice("back");
  const { hasPermission, requestPermission } = useCameraPermission();
  const [locked, setLocked] = useState(false); // ignore scans while resolving/navigating
  const resolve = useResolveScanToken();
  const scanner = useCodeScanner({
    codeTypes: ["qr"],
    onCodeScanned: (codes) => {
      const value = codes[0]?.value;
      if (!value || locked) return;
      setLocked(true);
      onToken(value).finally(() => setLocked(false));
    },
  });
  async function onToken(raw: string) {
    let token = raw;
    try { const parsed = JSON.parse(raw); if (parsed?.t) token = String(parsed.t); } catch { /* raw token */ }
    try {
      const res = await resolve.mutateAsync({ token, purpose: "dispense" });
      toast.show(t("pharmacy.resolved"), "success");
      router.push(`/(pharmacist)/?patient=${encodeURIComponent(res.patient.id)}` as any);
    } catch (e: any) { toast.show(e?.message || t("common.error"), "danger"); }
  }
  ```
  Render: if no device → manual-only (`pharmacy.noCamera`); else if !hasPermission → Enable-camera button (`requestPermission()`); else `<Camera style={StyleSheet.absoluteFill} device={device} isActive={isFocused && !locked} codeScanner={scanner} />` with overlay hint + manual fallback section below (token input + patient-ID input + Find button → same `onToken`/direct queue push). `isFocused` via `useIsFocused` from `@react-navigation/native` (already a dep). Manual patient-ID path pushes `/(pharmacist)/?patient=<id>` directly without resolve.

- [ ] **Step 5: Verify**
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep -E "pharmacist|useApi|en\.json|si\.json|ta\.json" || echo CLEAN`
  Expected: `CLEAN` (camera types resolve from installed 4.7.3).
  Smoke (dev build, NOT Expo Go): pharmacist login → queue default `signed` → detail → dispense with token → scan QR → filtered queue. Manual-entry path smoke-testable in Expo Go.

- [ ] **Step 6: Commit**
  ```bash
  git add apps/mobile/src/app/\(pharmacist\)/ apps/mobile/src/hooks/useApi.ts apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
  git commit -m "feat(mobile): pharmacist dispense queue, detail, and QR scan"
  ```

---

### Task 3: Role routing + register + camera config

**Files:**
- Modify: `apps/mobile/src/hooks/useProtectedRoute.ts` (2 functions)
- Modify: `apps/mobile/src/app/(auth)/register.tsx` (enum + picker + post-register route)
- Modify: `apps/mobile/app.config.js` (plugins)
- Modify: `src/i18n/locales/{en,si,ta}.json` (register role label, if keyed)

**Interfaces:**
- Consumes: `(pharmacist)/` routes from Task 2.
- Produces: `pharmacy`-role users land in `/(pharmacist)` on login/register.

- [ ] **Step 1: Route guards**
  In `homeForRole` add before the caretaker branch:
  ```ts
  : role === "pharmacy"
  ? "/(pharmacist)"
  ```
  Same in `groupForRole` returning `"(pharmacist)"`. In the wrong-group bounce list (`["(app)", "(doctor)", "(admin)", "(caretaker)"]`, useProtectedRoute.ts:123) add `"(pharmacist)"`.

- [ ] **Step 2: Register screen**
  `register.tsx:73`: extend zod enum with `"pharmacy"`; `useState` type at :167 likewise. Picker array (~:462): add `{ value: "pharmacy", label: <role label>, hint: <hint>, icon: PillIcon }` — check what icon the picker rows use (`User`/`Stethoscope` imported; `PillIcon` alias may already exist or add import). Post-register routing (~:301): `(data.role as string) === "doctor" ? "/(doctor)" : "/(app)"` → nest pharmacy: `=== "doctor" ? "/(doctor)" : (data.role as string) === "pharmacy" ? "/(pharmacist)" : "/(app)"`. Role-dependent required-field blocks (:99-146 patient/doctor checks) — pharmacy needs no extra fields (NIC/DOB optional server-side for non-patients), so no changes there; verify by reading the block.

- [ ] **Step 3: Camera plugin + verify**
  In `app.config.js` plugins array add `"react-native-vision-camera"` (its `app.plugin.js` injects CAMERA permission + usage strings; verify key name by reading `node_modules/react-native-vision-camera/app.plugin.js` header first — if it exports a different plugin path, use that). Note: requires a fresh dev build; Expo Go camera tab will show the manual fallback.
  Run: `cd apps/mobile && npx tsc --noEmit 2>&1 | grep -v TS2786 | grep -E "useProtectedRoute|register|pharmacist" || echo CLEAN`
  Expected: `CLEAN`.
  Smoke: register as pharmacy → lands `/(pharmacist)`; kill + relaunch → still lands there (guard).

- [ ] **Step 4: Commit**
  ```bash
  git add apps/mobile/src/hooks/useProtectedRoute.ts apps/mobile/src/app/\(auth\)/register.tsx apps/mobile/app.config.js apps/mobile/src/i18n/locales/en.json apps/mobile/src/i18n/locales/si.json apps/mobile/src/i18n/locales/ta.json
  git commit -m "feat(mobile): pharmacy role routing, registration, camera config"
  ```

---

## Self-Review

- **Spec coverage:** Slice 2 items all tasked — queue (§3 queue → Task 2 Steps 1-2), detail dispense/reject (→ Step 3), scan (→ Step 4), routing/register/camera (§1 → Task 3).
- **Placeholder scan:** Endpoint paths/params pinned to backend source (`patient` query param, `x-dispense-token` header, `TOKEN_MISSING` contract); vision-camera API pinned to installed 4.7.3 sources (`useCameraDevice('back')`, `useCameraPermission`, `useCodeScanner`, `Code.value`); no TBDs. One read-first: plugin key in `app.plugin.js`, `nav.tabs` key shape, register picker icon.
- **Type consistency:** Hook names/keys (`["pharmacy", ...]`) used identically in Tasks 1–2; route strings `/(pharmacist)/...` consistent; role string `pharmacy` matches backend `requireRole("pharmacy")` + register enum.
- **Deviations from Slice 1 pattern:** none structural; scan screen is the first vision-camera consumer (manual fallback mandatory).
