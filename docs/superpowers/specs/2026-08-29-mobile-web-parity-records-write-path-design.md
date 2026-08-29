# Mobile ↔ Web Patient Parity — Sub-project 2a (Records Write-Path Single-Record UX)

**Date:** 2026-08-29
**Status:** Approved
**Scope:** Bring `/patient/records/[id]` from read-only to full write-path parity with the mobile `record-detail` screen. Add create + edit routes. Mirror the mobile mutation surface (edit, delete, archive, restore, move-to-family, re-extract) plus an attachments section (list, upload, download, delete) and a structured-children section (lab results / imaging findings / discharge events / vaccination doses / prescription items) that renders only the section matching `record.kind`.

Out of scope for this sub-project: bulk mutations on the records list, search/filter/multi-select polish on the list (SP2b), consents + DSAR pages (SP2c).

---

## 1. Goal

The mobile `record-detail` screen is the centre of medical-record interaction on mobile. It exposes six mutation entry points (edit, archive, restore, move-to-family, delete, re-extract) and surfaces two read-side layers (attachments, structured children). Today's `/patient/records/[id]` is a 50-line read-only card. Parity means the web detail page matches that surface.

A patient on web must be able to create a record from scratch, edit its metadata, attach a file, re-run extraction against an attached file, archive it, restore it, move it to a family member, delete it, and read its structured child rows when the record kind supports them.

### Definition of done

| | |
|---|---|
| **1.** | `/patient/records/new` exists; submitting it persists a record via `POST /medical-records/envelope` and routes the user to `/patient/records/{id}`. |
| **2.** | `/patient/records/[id]/edit` exists; submitting it persists a `PATCH` and returns to detail. |
| **3.** | `/patient/records/[id]` shows an actions bar with: Edit, Archive/Restore, Move to family, Re-extract (when attachments exist), Delete. Each action either succeeds or surfaces a toast on failure; on success the page state reflects the change. |
| **4.** | The detail page shows an Attachments section: list rows with filename / size / mime icon / Download / Delete, plus an "Add attachment" file picker that uploads via `POST /files/upload` (with `recordId`). |
| **5.** | The detail page shows a Structured children section that renders only the matching sub-component for `record.kind` (lab → results table, imaging → findings card, discharge → events list, vaccination → doses list, prescription → items list). Other kinds render nothing. |
| **6.** | All new mutations invalidate the right query keys so the list, detail, and child sections stay in sync without manual refresh. |
| **7.** | `docs/parity-manifest.md` flips two rows to `done`: `(app)/add-record` → `/patient/records/new`, `(app)/edit-record` → `/patient/records/[id]/edit`. The `(app)/record-detail` row notes update to acknowledge the write-path is now on web. |
| **8.** | Marketing test count of failing tests ≤ baseline (8 pre-existing failures). New tests added for each new page, hook, and component. |
| **9.** | No new dependencies; no separate business logic between web and mobile beyond API contract differences (mobile uses ad-hoc React-Query keys in `useApi.ts`; web uses the `patientKeys` factory — that's a pre-existing layering decision, not a regression). |

---

## 2. What's in scope

### 2.1 New pages

| Route | Source of UX parity |
|---|---|
| `apps/marketing/src/app/patient/(app)/records/new/page.tsx` | Mobile `apps/mobile/src/app/(app)/add-record.tsx` |
| `apps/marketing/src/app/patient/(app)/records/[id]/edit/page.tsx` | Mobile `apps/mobile/src/app/(app)/edit-record.tsx` |

### 2.2 Expanded page

| Route | Expansion |
|---|---|
| `apps/marketing/src/app/patient/(app)/records/[id]/page.tsx` | Add actions bar, attachments section, structured-children section |

### 2.3 New components

| Path | Purpose |
|---|---|
| `apps/marketing/src/patient/components/records/RecordActionsBar.tsx` | Edit / Archive/Restore / Move / Re-extract / Delete buttons |
| `apps/marketing/src/patient/components/records/RecordAttachmentsSection.tsx` | List + upload + download + delete attachments |
| `apps/marketing/src/patient/components/records/StructuredChildren.tsx` | Kind-switched container for child sections |
| `apps/marketing/src/patient/components/records/LabResultsTable.tsx` | Renders `useRecordLabResults` items |
| `apps/marketing/src/patient/components/records/ImagingFindingsCard.tsx` | Renders `useRecordImagingFindings` |
| `apps/marketing/src/patient/components/records/DischargeEventsList.tsx` | Renders `useRecordDischargeEvents` |
| `apps/marketing/src/patient/components/records/VaccinationDosesList.tsx` | Renders `useRecordVaccinationDoses` |
| `apps/marketing/src/patient/components/records/PrescriptionItemsList.tsx` | Renders `useRecordPrescriptionItems` |
| `apps/marketing/src/patient/components/records/RecordForm.tsx` | Shared form for new + edit pages |

### 2.4 Shared contracts additions

`packages/shared/src/contracts/paths.ts`:

```
records.create(): "/medical-records/envelope"
records.update(id): "/medical-records/{id}"
records.delete(id): "/medical-records/{id}"
records.attachments(id): "/files/record/{id}"
records.attachmentUpload(): "/files/upload"
records.attachmentDelete(id): "/files/{id}"
records.attachmentPresign(): "/files/presign"
records.attachmentDownload(key, stream): "/files/download/{key}?stream={stream}"
records.reExtract(id): "/medical-records/{id}/re-extract"
records.children.lab(id): "/medical-records/{id}/lab-results"
records.children.imaging(id): "/medical-records/{id}/imaging-findings"
records.children.discharge(id): "/medical-records/{id}/discharge-events"
records.children.vaccination(id): "/medical-records/{id}/vaccination-doses"
records.children.prescription(id): "/medical-records/{id}/prescription-items"
```

`packages/shared/src/contracts/keys.ts`:

```
patientKeys.recordAttachments(id): ["patient", "records", id, "attachments"]
patientKeys.recordChildren(id, kind): already exists; first real consumer
patientKeys.recordPresign(): ["patient", "files", "presign"]
```

`packages/shared/src/contracts/types.ts`:

```
RecordCreateInput {
  kind: RecordKind,                 // from @healthcare/shared/records
  title: string,                    // max 240 (matches envelope schema)
  summary?: string,
  notes?: string,
  diagnosis?: string,
  tags?: string[],                  // ≤40 chars each, normalised lowercase, deduped
  familyMemberId?: string | null,
  recordDate?: string,              // ISO
}

RecordUpdateInput {
  id: string,
  title?: string,
  diagnosis?: string,
  summary?: string,
  notes?: string,
  date?: string,                    // ISO
  followUpDate?: string,            // ISO
  recordType?: string,              // backward-compat with doctor-side PATCH
  tags?: string[],
  familyMemberId?: string | null,
  archived?: boolean,
}

RecordAttachment {
  id: string,
  fileName: string,
  mimeType: string,
  size: number,
  uploadedAt: string,               // ISO
  r2Key?: string,
}

// Per-kind child shapes are inferred from existing API response rows;
// add discriminated union if a single shared type is needed.
```

### 2.5 Web hooks

Extend `apps/marketing/src/patient/hooks/records.ts` (one file, mirrors existing pattern; no new file):

```
// Reads (existing)
useRecords({type?, search?, limit?})
useRecordStats()
useRecord(id)
useLabResults({months?, test?})

// Reads (new)
useRecordAttachments(id)
useRecordLabResults(id)
useRecordImagingFindings(id)
useRecordDischargeEvents(id)
useRecordVaccinationDoses(id)
useRecordPrescriptionItems(id)

// Mutations (new)
useCreateRecord()             // POST envelope
useUpdateRecord()             // PATCH /medical-records/{id}
useDeleteRecord()             // DELETE /medical-records/{id}
useArchiveRecord()            // PATCH {archived:true}
useRestoreRecord()            // PATCH {archived:false}
useMoveRecord()               // PATCH {familyMemberId}
useAddAttachment(id)          // POST /files/upload with recordId
useDeleteAttachment()         // DELETE /files/{id}
usePresignAttachment()        // POST /files/presign
useReExtractRecord(id)        // POST /medical-records/{id}/re-extract
```

Each mutation invalidates the relevant keys: `patientKeys.records(...)` (list), `patientKeys.record(id)` (detail), `patientKeys.recordAttachments(id)` (attachments section), `patientKeys.recordChildren(id, kind)` (matching child section).

---

## 3. Approach

### 3.1 Create path

`POST /medical-records/envelope` is patient-allowed (`requireRole("patient")` in `apps/api/src/routes/medical-records.ts`). It accepts text-only metadata (`kind`, `title`, `summary`, `notes`, `diagnosis`, `tags`, `familyMemberId`, `recordDate`) and persists via the encrypted envelope write path.

This is the only patient-create path on the API today. The doctor-side `POST /medical-records` is gated to `requireRole("doctor", "hospital_staff", "hospital_admin")`. Mobile's `useCreateMedicalRecord` calls `POST /medical-records` directly — that flow is broken for patients in production. Mobile's `useWriteRecordEnvelope` calls the envelope endpoint and is the working patient-create path. The web create page uses the envelope path.

Files attached after creation. No file required at create-time. Re-extract button on detail is disabled when there are zero attachments.

### 3.2 Edit path

`PATCH /medical-records/{id}` is the canonical mutation. Title / diagnosis / summary / notes / date / followUpDate / recordType / tags / archived / familyMemberId are all in scope. The web edit page exposes the same set as mobile's `edit-record.tsx` plus tags.

Tags are edited via the edit page (not inline). Mirrors mobile's choice — there's no inline tag-chip editor on mobile.

Kind is locked after creation (matches mobile: `edit-record.tsx` shows the chips but doesn't change them on submit; web form makes kind read-only on edit).

### 3.3 Action bar

Right-aligned row above the metadata block. Buttons shown conditionally:

| Button | Shown when | Behaviour |
|---|---|---|
| Edit | Always | `router.push("/patient/records/{id}/edit")` |
| Archive | `!archivedAt` | `useArchiveRecord` → toast "Archived" |
| Restore | `archivedAt` | `useRestoreRecord` → toast "Restored" |
| Move to family | Always | Open dropdown; pick "Myself" or family member; `useMoveRecord` |
| Re-extract | `attachments.length > 0` | `useReExtractRecord`; toast on success / failure; refetch child keys |
| Delete | Always | Confirm modal; `useDeleteRecord` → `router.push("/patient/records")` |

Confirm modals reuse the existing `confirmDialog` pattern (search codebase for current implementation; follow the existing import path — do not introduce a new modal library).

### 3.4 Attachments

`useRecordAttachments(id)` reads `GET /files/record/{recordId}`. Returns `{ files: FileRow[] }`. Each row renders with a mime icon, filename, size (human-readable), uploaded-at label, and Download / Delete buttons.

**Add attachment:**
- `<input type="file" accept="application/pdf,image/*">` (matches API allowed MIME list minus DICOM/video/audio — those are out of scope for web patient uploads)
- On change, append file + `recordId` to `FormData`
- `useAddAttachment(id).mutateAsync(formData)` → POST `/files/upload`
- On success, invalidate `patientKeys.recordAttachments(id)`
- Client-side cap: 50 MB (matches `apps/api/src/routes/files.ts` server check)
- Client-side MIME check: same allowlist as server, before submitting

**Download:**
- `usePresignAttachment().mutateAsync({fileId})` → POST `/files/presign` → `{ token, expiresAt, url }`
- Open `url` in a new tab (`window.open(url, '_blank', 'noopener,noreferrer')`)
- Token has 5-minute TTL per `apps/api/src/routes/files.ts`

**Delete:**
- Confirm modal
- `useDeleteAttachment().mutateAsync({id})` → DELETE `/files/{id}`
- Invalidate `patientKeys.recordAttachments(id)` + `patientKeys.record(id)` (the parent record's `attachments.first` may change)

### 3.5 Structured children

`<StructuredChildren recordId={id} kind={kind} />` switches on `kind` and renders one component. Each child component is read-only on the patient side; the doctor's structured-data writes are out of scope for parity.

| `kind` | Component | Hook | Notes |
|---|---|---|---|
| `lab_report` | `<LabResultsTable>` | `useRecordLabResults(id)` | Table: test, value, unit, reference range, flag, collected at |
| `imaging` | `<ImagingFindingsCard>` | `useRecordImagingFindings(id)` | Single findings card (modalities, impression) |
| `discharge_summary` | `<DischargeEventsList>` | `useRecordDischargeEvents(id)` | List of events with date + description |
| `vaccination` | `<VaccinationDosesList>` | `useRecordVaccinationDoses(id)` | List of doses with date + lot + administered-by |
| `prescription` | `<PrescriptionItemsList>` | `useRecordPrescriptionItems(id)` | List of medicines from the prescription |

For all other kinds (e.g. `referral`, `insurance`, `other`), render nothing.

Empty arrays render the section with "No data" copy + a Re-extract call-to-action button when attachments exist. The existing pattern (search the codebase for empty-state copy in record sections) is the style to follow.

### 3.6 Kind taxonomy

`@healthcare/shared/records` exposes `RecordKind` (22 values) as the canonical registry. Mobile's `add-record.tsx` only shows 13 of those (subset from `recordImportance.ts`). The web create page shows all 22 from the registry, ordered by `RECORD_CATEGORIES`. This is intentional: web is a fuller surface; mobile can adopt later.

---

## 4. Constraints

- **Branch: `feat/mobile-web-parity`.**
- **No new npm dependencies.** Use existing `@/patient/hooks`, `@healthcare/shared/contracts`, `@healthcare/shared/records`. React Query already in place.
- **File picker: HTML `<input type="file">` with `FormData`.** No native camera on web; SP6 covers OCR upload.
- **Tag normalisation**: lowercase, trim, dedupe, drop empties, ≤40 chars each. Mirror mobile's tag handling (search mobile codebase for the helper).
- **Confirm modals**: use existing `confirmDialog` pattern. Search codebase before adding any modal primitives.
- **Test command from `apps/marketing`**: `bun run test`. Typecheck: `bun run typecheck`.
- **Mobile typecheck has pre-existing ReactNode/bigint error** unrelated to parity work. Repo-root `bun run typecheck` may still surface it; focus on `apps/marketing` typecheck delta.
- **Test count must not regress.** Baseline: 8 pre-existing failures.
- **`docs/parity-manifest.md` is the parity contract.** Any new parity-relevant page must be added there with `done` once shipped.
- **No separate business logic for web and mobile.** Where the API differs by role (patient-create goes via envelope; doctor-create goes via `/medical-records`), both web and mobile use the same endpoint per role. Do not fork the create logic.

---

## 5. Architecture (data flow)

```
[User]
  → /patient/records/new (page)
    → <RecordForm mode="create">
      → useCreateRecord() ← patientPaths.records.create()
        → POST /medical-records/envelope
          → API writes envelope, returns { id, envelopeVersion }
      → router.push("/patient/records/{id}")

[User]
  → /patient/records/{id}/edit (page)
    → <RecordForm mode="edit" record={data}>
      → useUpdateRecord() ← patientPaths.records.update(id)
        → PATCH /medical-records/{id}
          → API mutates row + (optionally) re-indexes FTS5
      → router.push("/patient/records/{id}")

[User]
  → /patient/records/{id} (page)
    → useRecord(id)            ← metadata
    → useRecordAttachments(id) ← attachments list
    → <RecordActionsBar>
      → useArchiveRecord() / useRestoreRecord() / useMoveRecord()
        → PATCH /medical-records/{id} { archived | familyMemberId }
      → useDeleteRecord()
        → DELETE /medical-records/{id}
      → useReExtractRecord(id)
        → POST /medical-records/{id}/re-extract
    → <RecordAttachmentsSection>
      → useRecordAttachments(id) (reused for current list)
      → useAddAttachment(id)    ← POST /files/upload (multipart)
      → usePresignAttachment()  ← POST /files/presign
      → useDeleteAttachment()   ← DELETE /files/{id}
    → <StructuredChildren recordId kind>
      → useRecordLabResults(id)              if kind === "lab_report"
      → useRecordImagingFindings(id)         if kind === "imaging"
      → useRecordDischargeEvents(id)         if kind === "discharge_summary"
      → useRecordVaccinationDoses(id)        if kind === "vaccination"
      → useRecordPrescriptionItems(id)       if kind === "prescription"
```

Every mutation invalidates the matching key:
- `useCreateRecord` / `useUpdateRecord` / `useDeleteRecord` / `useArchiveRecord` / `useRestoreRecord` / `useMoveRecord` / `useReExtractRecord` → `["patient", "records", ...]` (list, stats, detail, attachments, children)
- `useAddAttachment` / `useDeleteAttachment` / `usePresignAttachment` → `["patient", "records", id, "attachments"]` + `["patient", "records", id]` (parent's `attachments.first` may change)
- `useReExtractRecord` additionally invalidates `["patient", "records", id, kind]` for each applicable kind

`patientKeys.recordChildren(id, kind)` already exists; this sub-project is its first consumer. Key factory stays in `packages/shared/src/contracts/keys.ts`.

---

## 6. Testing

### 6.1 Page tests

| File | Coverage |
|---|---|
| `apps/marketing/src/app/patient/(app)/records/new/page.test.tsx` | Renders form; submitting calls `useCreateRecord`; success navigates to detail |
| `apps/marketing/src/app/patient/(app)/records/[id]/edit/page.test.tsx` | Renders pre-filled form; save calls `useUpdateRecord`; delete button confirms then calls `useDeleteRecord` and routes to list |
| `apps/marketing/src/app/patient/(app)/records/[id]/page.test.tsx` | Expands from read-only to include actions bar, attachments, children; archive/restore button toggles label; delete button confirms |

### 6.2 Component tests

| File | Coverage |
|---|---|
| `apps/marketing/src/patient/components/records/RecordActionsBar.test.tsx` | All six buttons render with correct enabled state; click handlers fire the right hooks |
| `apps/marketing/src/patient/components/records/RecordAttachmentsSection.test.tsx` | List renders; add button triggers file picker and uploads; download presigns and opens URL; delete confirms |
| `apps/marketing/src/patient/components/records/StructuredChildren.test.tsx` | Switches on `kind`; renders correct child; renders nothing for non-matching kinds |
| Each of `LabResultsTable`, `ImagingFindingsCard`, `DischargeEventsList`, `VaccinationDosesList`, `PrescriptionItemsList` | Renders rows from mock data; shows empty state when array is empty |

### 6.3 Hook tests

`apps/marketing/src/patient/hooks/records.test.ts` (extend existing or create):

- `useRecordAttachments(id)` returns parsed list
- Each mutation invalidates the right keys on success
- `usePresignAttachment` returns `{ token, expiresAt, url }`

### 6.4 Static tests

- Extend `apps/marketing/src/portal/redirects.test.ts` if any new redirects added (none planned for SP2a)
- Add `apps/marketing/src/patient/hooks/records.test.ts` assertions that `patientPaths.records.{create,update,reExtract,...}` produce the expected URL strings — guards against path-builder drift

### 6.5 Parity test

`apps/marketing/src/patient/parity.test.ts` already enforces that `done` rows resolve to a real page file. After flipping the two manifest rows, this test must pass.

### 6.6 Test command

```
cd apps/marketing && bun run test
```

Failure count must be ≤ baseline (8 pre-existing fails). New failures → fix.

---

## 7. Sub-project boundaries

What this sub-project owns:
- `/patient/records/new` create page
- `/patient/records/[id]/edit` edit page
- `/patient/records/[id]` expansion (actions, attachments, structured children)
- 9 new components under `apps/marketing/src/patient/components/records/`
- Shared contracts additions: paths, keys, types
- Web hooks additions in `apps/marketing/src/patient/hooks/records.ts`
- Parity manifest updates

What this sub-project explicitly does NOT own:
- Bulk mutation UX on `/patient/records` list (multi-select, bulk-archive, bulk-tag, bulk-move) — SP2b
- Search/filter/smart-folder polish on `/patient/records` list — SP2b
- Consent granting/revocation UI, consent audit, DSAR pages — SP2c
- OCR capture (mobile's records/scan) — SP6
- Mobile-side rewrite of add-record / edit-record / record-detail to match the web hook layer — out of scope (mobile uses ad-hoc hooks; the parity contract is feature parity, not code parity)

---

## 8. Acceptance criteria

1. `GET /patient/records/new` returns 200 with the create form.
2. `GET /patient/records/{id}/edit` returns 200 with the pre-filled edit form.
3. `GET /patient/records/{id}` returns 200 with metadata + actions bar + attachments section + (kind-matching) structured-children section.
4. Submitting the create form produces a row readable at `/patient/records/{id}`.
5. Submitting the edit form updates the row in place; navigating back to detail shows the new values.
6. Archive toggles `archivedAt`; UI re-renders with "Restore" button and "(archived)" pill.
7. Move to family updates `familyMemberId`; record appears under the chosen family member's records list.
8. Re-extract fires `POST /medical-records/{id}/re-extract`; toast surfaces success/failure; child section refetches.
9. Delete confirms then routes to `/patient/records`; record no longer reachable.
10. Add-attachment uploads via multipart; new row appears in the list immediately.
11. Download presigns then opens the URL in a new tab.
12. Delete-attachment confirms then removes the row from the list.
13. Structured-children section is empty for `referral`, `insurance`, `other`, etc., and shows the matching child component for `lab_report`, `imaging`, `discharge_summary`, `vaccination`, `prescription`.
14. `docs/parity-manifest.md` has two new `done` rows: `(app)/add-record` → `/patient/records/new` and `(app)/edit-record` → `/patient/records/[id]/edit`. The `(app)/record-detail` row notes update.
15. `apps/marketing/src/patient/parity.test.ts` passes.
16. `cd apps/marketing && bun run test` shows ≤ 8 failing tests.
17. `bunx tsc --noEmit -p apps/marketing/tsconfig.json` shows no new errors beyond the 32-pre-existing baseline.