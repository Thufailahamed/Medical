import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb } from "./lib/db";
import { localeMiddleware } from "./middleware/locale";
import { familyContextMiddleware } from "./middleware/family-context";
import { caretakerContextMiddleware } from "./middleware/caretaker-context";
import { tenantContextMiddleware } from "./middleware/tenant-context";
import authRoutes from "./routes/auth";
import patientsRoutes from "./routes/patients";
import medicalRecordsRoutes from "./routes/medical-records";
import appointmentsRoutes from "./routes/appointments";
import emergencyRoutes from "./routes/emergency";
import aiRoutes from "./routes/ai";
import filesRoutes from "./routes/files";
import medicinesRouter from "./routes/medicines";
import medicinesMasterRouter from "./routes/medicines-master";
import safetyRouter from "./routes/safety";
import signatureRouter from "./routes/signature";
import doctorRouter from "./routes/doctor";
import notificationsRouter from "./routes/notifications";
import hospitalsRouter from "./routes/hospitals";
import vitalsRouter from "./routes/vitals";
import notesRouter from "./routes/notes";
import dosesRouter from "./routes/doses";
import auditRouter from "./routes/audit";
import paymentsRouter from "./routes/payments";
import mfaRouter from "./routes/mfa";
import insuranceRouter from "./routes/insurance";
import labsRouter from "./routes/labs";
import wellnessRouter from "./routes/wellness";
import doctorPortalRouter from "./routes/doctor-portal";
import hospitalPortalRouter from "./routes/hospital-portal";
import hospitalAdmissionsRouter from "./routes/hospital-admissions";
import hospitalBillingRouter from "./routes/hospital-billing";
import hospitalPharmacyRouter from "./routes/hospital-pharmacy";
import hospitalReportsRouter from "./routes/hospital-reports";
import chatRouter from "./routes/chat";
import allergiesRouter from "./routes/allergies";
import vaccinationsRouter from "./routes/vaccinations";
import timelineRouter from "./routes/timeline";
import healthSummaryRouter from "./routes/health-summary";
import exportRouter from "./routes/export";
import shareRouter from "./routes/share";
import pushRouter from "./routes/push";
import walkInsRouter from "./routes/walk-ins";
import emailRouter from "./routes/email";
import classificationRouter from "./routes/classification";
import demoRouter from "./routes/demo";
import slmcRouter from "./routes/slmc";
import marketingRouter from "./routes/marketing";
import doctorMessagesRouter from "./routes/doctor-messages";
import patientMessagesRouter from "./routes/patient-messages";
import doctorScheduleRouter from "./routes/doctor-schedule";
import doctorEarningsRouter from "./routes/doctor-earnings";
import doctorRxTemplatesRouter from "./routes/doctor-rx-templates";
import careTeamRouter from "./routes/care-team";
import pharmaciesRouter from "./routes/pharmacy";
import clinicsRouter from "./routes/clinics";
import consentsRouter from "./routes/consents";
import dsarRouter from "./routes/dsar";
import hospitalDoctorsRouter from "./routes/hospital-doctors";
import hospitalPatientsRouter from "./routes/hospital-patients";
import clinicDoctorsRouter from "./routes/clinic-doctors";
import clinicPatientsRouter from "./routes/clinic-patients";
import doctorPatientRelationshipsRouter from "./routes/doctor-patient-relationships";
import meTenantsRouter from "./routes/me-tenants";
import { handleInboundEmail } from "./email/inbound";
import { bookingRemindersRouter } from "./cron/booking-reminders";
import { doseRemindersRouter } from "./cron/dose-reminders";
import { refillRemindersRouter } from "./cron/refill-reminders";
import { reclassifyRouter } from "./cron/reclassify";
import { vaccinationRemindersRouter } from "./cron/vaccination-reminders";
import { symptomAnomaliesRouter } from "./cron/symptom-anomalies";
import { postVisitSummaryRouter } from "./cron/post-visit-summary-router";
import { preVisitSummaryRouter } from "./cron/pre-visit-summary-router";
import ratingsRouter from "./routes/ratings";
import familyActiveRouter from "./routes/family-active";
import adminRouter from "./routes/admin";
import adminBulkRouter from "./routes/admin-bulk";
import adminExportRouter from "./routes/admin-export";
import adminWebauthnRouter from "./routes/admin-webauthn";
import adminImpersonateRouter from "./routes/admin-impersonate";
import adminHealthRouter from "./routes/admin-health";
import adminOperatorRouter from "./routes/admin-operator";
import familyInviteRouter from "./routes/family-invites";
import caretakerInviteRouter from "./routes/caretaker-invites";
import caretakerLinksRouter from "./routes/caretaker-links";
import caretakerVerificationsRouter from "./routes/caretaker-verifications";
import caretakerMarketplaceRouter from "./routes/caretaker-marketplace";
import marketplaceCaretakersRouter, {
  marketplaceInquiriesRouter,
} from "./routes/marketplace-caretakers";
import adminCaretakerVerificationsRouter from "./routes/admin-caretaker-verifications";
import invitePageRouter from "./routes/invite-page";
import familyLockRouter from "./routes/family-lock";
import whatsappRouter from "./routes/whatsapp";
import staffInvitePublicRouter from "./routes/staff-invites-public";
// Phase HOS-14: inter-hospital collaboration — record requests, referrals,
// lab routing, consult notes, discharge handoffs.
import hospitalShareRequestsRouter from "./routes/hospital-share-requests";
import crossHospitalReferralsRouter from "./routes/cross-hospital-referrals";
import crossHospitalLabRoutingsRouter from "./routes/cross-hospital-lab-routings";
import consultNotesRouter from "./routes/consult-notes";
import dischargeHandoffsRouter from "./routes/discharge-handoffs";
import realtimeRouter from "./routes/realtime";
import healthIdRouter, { scanRouter } from "./routes/health-id";
import teleconsultRouter from "./routes/teleconsult";
import { TeleconsultRoom } from "./durable-objects/teleconsult-room";
import type { AppEnvironment } from "./types";

const app = new Hono<AppEnvironment>();

// ─── Global middleware ───────────────────────────────────
app.use("*", logger());
// CORS allowlist: the Expo mobile app (localhost:8081 in dev,
// exp.host preview builds) + the marketing landing page
// (healthhub.app and localhost for local previews of the
// marketing site). Add additional origins here as we ship
// more subdomains (e.g. doctor.healthhub.app).
app.use("*", cors({
  origin: [
    "http://localhost:8081",
    "https://*.exp.host",
    "https://healthhub.app",
    "https://www.healthhub.app",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
  ],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowHeaders: [
    "Content-Type",
    "Authorization",
    "Accept-Language",
    // E-Rx safety override ack (doctor confirmed a blocking warning).
    "X-Confirm-Warning",
    // Family + tenant + caretaker context headers set by the clients.
    "x-active-family-member-id",
    "x-active-principal-patient-id",
    "x-active-hospital-id",
    "x-active-clinic-id",
    "x-timezone-offset",
  ],
  // Phase 1.3: enable credentials so the portal can carry the
  // httpOnly `portal_session` cookie across cross-origin XHR.
  // The mobile app doesn't send cookies (Bearer-only), so the
  // upgrade is safe for it too.
  credentials: true,
  maxAge: 86400,
}));

// ─── DB middleware ────────────────────────────────────────
app.use("*", async (c, next) => {
  c.set("db", createDb(c.env.DB));
  await next();
});

// ─── Locale middleware ────────────────────────────────────
// Resolves Accept-Language → en|si|ta and stashes on c.get("locale").
app.use("*", localeMiddleware);

// ─── Family-context middleware (Phase 2.3) ──────────────
// Reads `x-active-family-member-id` header (or falls back to
// `users.active_family_member_id` column) and stashes the resolved id
// on `c.get("activeFamilyMemberId")`. No-op for unauthenticated
// requests — let auth handle them.
app.use("*", familyContextMiddleware);

// ─── Caretaker-context middleware (Phase Caretaker-Profiles) ─
// Reads `x-active-principal-patient-id` header (or falls back to
// `users.active_principal_patient_id` column) and stashes the resolved
// id on `c.get("activePrincipalPatientId")` + linkId on
// `c.get("activeCaretakerLinkId")`. No-op for non-caretaker roles and
// for unauthenticated requests (cron + email + health probes pass
// through unchanged).
app.use("*", caretakerContextMiddleware);

// ─── Tenant-context middleware (Phase MTN-1) ─────────────
// Reads `x-active-hospital-id` / `x-active-clinic-id` headers
// (mutex, falls back to `users.active_tenant_*` columns). Validates
// membership and stashes on `c.get("activeHospitalId")` /
// `c.get("activeClinicId")`. No-op for unauthenticated requests
// (cron + email handlers + health probes pass through unchanged).
app.use("*", tenantContextMiddleware);

// ─── Health check ────────────────────────────────────────
app.get("/", (c) => {
  return c.json({
    name: "Healthcare Platform API",
    version: "0.1.0",
    status: "healthy",
  });
});

app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Routes ──────────────────────────────────────────────
app.route("/auth", authRoutes);
app.route("/patients", patientsRoutes);
app.route("/medical-records", medicalRecordsRoutes);
app.route("/appointments", appointmentsRoutes);
app.route("/appointments", ratingsRouter);
app.route("/emergency", emergencyRoutes);
app.route("/ai", aiRoutes);
app.route("/files", filesRoutes);
app.route("/medicines", medicinesRouter);
// Phase E-Rx 1: master catalogue lookup endpoints. Mounted before
// /doctor so the doctor prescription form's autocomplete hits the
// canonical DB-backed endpoint instead of the legacy in-memory
// `MEDICINE_CATALOG` array (medicines.ts /suggest still uses the
// in-memory array as a deprecated fallback for one release).
app.route("/medicines-master", medicinesMasterRouter);
// Phase E-Rx 3: safety pre-flight. Mounted at /safety so the doctor
// prescription form can `useSafetyCheck({patientId, candidate})` before
// posting the create call.
app.route("/safety", safetyRouter);
// Phase E-Rx 6: signing + verification. The router exposes both the
// doctor-only endpoints (mounted at /doctor/* via the router itself)
// and the public /verify/:id (mounted at root below).
app.route("/", signatureRouter);
app.route("/doctor", doctorRouter);
app.route("/notifications", notificationsRouter);
app.route("/hospitals", hospitalsRouter);
app.route("/vitals", vitalsRouter);
app.route("/notes", notesRouter);
app.route("/doses", dosesRouter);
app.route("/audit", auditRouter);
// Phase 5: PayHere payment flow. /payments/initiate + /payments/notify
// + /payments/:appointmentId. Notify is public; others require auth.
app.route("/payments", paymentsRouter);
// Round 2 P0: TOTP MFA for doctors (HIPAA compliance floor).
// Mobile posts the mfaToken + TOTP to /mfa/challenge to mint a session.
app.route("/mfa", mfaRouter);
app.route("/insurance", insuranceRouter);
app.route("/labs", labsRouter);
app.route("/wellness", wellnessRouter);
app.route("/doctor-portal", doctorPortalRouter);
app.route("/hospital-portal", hospitalPortalRouter);
app.route("/hospital-portal/admissions", hospitalAdmissionsRouter);
app.route("/hospital-portal/billing", hospitalBillingRouter);
app.route("/hospital-portal/pharmacy", hospitalPharmacyRouter);
app.route("/hospital-portal/reports", hospitalReportsRouter);
app.route("/chat", chatRouter);
app.route("/allergies", allergiesRouter);
app.route("/vaccinations", vaccinationsRouter);
app.route("/family", familyActiveRouter);
app.route("/family", familyInviteRouter);
app.route("/family", familyLockRouter);
// Caretaker Profiles: cross-account identity linking + active-principal
// switch + verified-tier request lifecycle. Mounted at /caretaker
// (sibling of /family).
app.route("/caretaker", caretakerInviteRouter);
app.route("/caretaker", caretakerLinksRouter);
app.route("/caretaker", caretakerVerificationsRouter);
// Caretaker Marketplace: discovery + inquiry surface. Mounted at
// /caretaker/marketplace (caretaker-side listing mgmt) and
// /marketplace/* (patient-side discovery + inquiries).
app.route("/caretaker/marketplace", caretakerMarketplaceRouter);
app.route("/marketplace/caretakers", marketplaceCaretakersRouter);
app.route("/marketplace/inquiries", marketplaceInquiriesRouter);
app.route("/timeline", timelineRouter);
app.route("/health-summary", healthSummaryRouter);
app.route("/export", exportRouter);
app.route("/share", shareRouter);
app.route("/push", pushRouter);
// Phase 3.1: demo-request lead capture. Mounted at root with explicit
// paths so the public POST is reachable without a /demo prefix.
app.route("/", demoRouter);
// Marketing site: public waitlist POST + super-admin read. Mounted at
// root for the same reason — the form on healthhub.app posts to
// /waitlist with no auth.
app.route("/", marketingRouter);
// Phase 3.1: SLMC verification for doctor accounts.
app.route("/", slmcRouter);
app.route("/walk-ins", walkInsRouter);
app.route("/doctor-messages", doctorMessagesRouter);
app.route("/patient-messages", patientMessagesRouter);
app.route("/doctor-schedule", doctorScheduleRouter);
app.route("/doctor-earnings", doctorEarningsRouter);
app.route("/doctor-rx-templates", doctorRxTemplatesRouter);
// Doctor↔Patient enterprise architecture: explicit care team
// membership table. Source of truth for "doctor X can read patient Y".
app.route("/care-team", careTeamRouter);
// Phase E-Rx 9: pharmacy dispensing surface. Tenant-scoped; lets a
// pharmacist list signed prescriptions awaiting dispense, mark them
// dispensed, or reject (signed → cancelled) with a reason. Mirrors
// the doctor-side audit chain via applyRxTransition.
app.route("/pharmacy", pharmaciesRouter);
// Phase v3: granular per-purpose consent + DSAR workflows.
app.route("/consents", consentsRouter);
app.route("/dsar", dsarRouter);
// Phase SYNC-1: SSE stream of newly-inserted notifications so web +
// mobile clients can invalidate React Query in real time.
app.route("/realtime", realtimeRouter);
// Phase MTN-1: multi-tenant hospital network — clinics + membership
// tables + clinical-context relationships + tenant switcher.
app.route("/clinics", clinicsRouter);
app.route("/hospital-doctors", hospitalDoctorsRouter);
app.route("/hospital-patients", hospitalPatientsRouter);
app.route("/clinic-doctors", clinicDoctorsRouter);
app.route("/clinic-patients", clinicPatientsRouter);
app.route("/doctor-patient-relationships", doctorPatientRelationshipsRouter);
// Phase HOS-14 mounts.
app.route("/hospital-share-requests", hospitalShareRequestsRouter);
app.route("/cross-hospital-referrals", crossHospitalReferralsRouter);
app.route("/cross-hospital-lab-routings", crossHospitalLabRoutingsRouter);
app.route("/consult-notes", consultNotesRouter);
app.route("/discharge-handoffs", dischargeHandoffsRouter);
app.route("/me", meTenantsRouter);
// QR-Code Check-in & Dispensing (Health ID). Patient endpoints under
// /me/health-id (issue / current / revoke); staff endpoint under
// /portal/scan/resolve. Both routers live in routes/health-id.ts.
app.route("/me/health-id", healthIdRouter);
app.route("/portal/scan", scanRouter);
// Round 4: In-App Video Teleconsultation. REST + WS upgrade mounted
// under /teleconsult/*; signaling itself lives in the TeleconsultRoom
// Durable Object (see durable-objects/teleconsult-room.ts).
app.route("/teleconsult", teleconsultRouter);
// Phase 1.4: email alias read/rotate. Mounted at root with absolute paths
// because the existing patientsRouter catches `:id` which would shadow it.
app.route("/", emailRouter);
app.route("/", whatsappRouter);
// Phase 2.1: AI auto-classify + trilingual FTS5 search.
app.route("/", classificationRouter);
// Phase 2.3.2: web landing page for family invite links. Mounted at root
// so the public URL is /invite/<token>, mirroring the mobile deep-link.
app.route("/", invitePageRouter);
// Phase 3.1 slice 3: public staff-invite preview + accept. Mounted at
// root for the same reason — these endpoints must be reachable without
// auth so the admin can share a deep link in WhatsApp.
app.route("/", staffInvitePublicRouter);
// Phase ADM-1: admin portal surface. Every endpoint gated by
// requireAdmin (super_admin only). See ./routes/admin.ts.
app.route("/admin", adminRouter);
app.route("/admin/bulk", adminBulkRouter);
app.route("/admin/export", adminExportRouter);
app.route("/admin/webauthn", adminWebauthnRouter);
app.route("/admin/impersonate", adminImpersonateRouter);
app.route("/admin/health", adminHealthRouter);
// Phase ADM-2: operator surface (super_admin + insurance/ambulance).
app.route("/admin/operator", adminOperatorRouter);
// Caretaker Profiles: admin verification queue (approve / reject / revoke).
app.route("/admin/caretaker-verifications", adminCaretakerVerificationsRouter);

// ─── Cron (Wrangler scheduled + manual POST for testing) ──
// Trigger via wrangler.toml: [triggers] crons = [...]
//   - "7 * * * *"        → booking reminders (hourly, off-minute)
//   - "3,8,13,...,58 * * * *" → dose reminders (every 5 min, off-minute)
//   - "37 3 * * *"       → refill reminders (daily 09:07 SL)
// Manual:
//   POST /__cron/booking-reminders        with x-cron-secret header.
//   POST /__cron/dose-reminders           with x-cron-secret header.
//   POST /__cron/refill-reminders         with x-cron-secret header.
//   POST /__cron/reclassify               with x-cron-secret header.
//   POST /__cron/vaccination-reminders    with x-cron-secret header.
//   POST /__cron/symptom-anomalies        with x-cron-secret header.
//   POST /__cron/post-visit-summary       with x-cron-secret header.
app.route("/", bookingRemindersRouter);
app.route("/", doseRemindersRouter);
app.route("/", refillRemindersRouter);
app.route("/", reclassifyRouter);
app.route("/", vaccinationRemindersRouter);
app.route("/", symptomAnomaliesRouter);
app.route("/", postVisitSummaryRouter);
app.route("/", preVisitSummaryRouter);

// ─── 404 ─────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// ─── Error handler ───────────────────────────────────────
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Phase 1.4: Cloudflare Email Routing wires the Worker's `email` handler
// directly (not via HTTP). Inbound mail hits `handleInboundEmail` first
// to resolve sender/alias → patient before any DB writes. Cf. Email
// Workers docs: the ExportedHandler.email property receives an
// EmailEvent-like message; we expose `handleInboundEmail` here.
export default {
  fetch: app.fetch,
  async email(message: any, env: any, ctx: any) {
    try {
      await handleInboundEmail(message, env, ctx);
    } catch (err) {
      // Anti-enumeration: never reply on errors. Drop silently.
      console.error("email handler error:", err);
    }
  },
  async scheduled(event: any, env: any, ctx: any) {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMin = now.getUTCMinutes();
    const paths: string[] = [];

    // 1. Dose reminders: run every 5 minutes (every trigger)
    paths.push("/__cron/dose-reminders");
    // Tier 1 records PR3: pre-visit summary sweeps every 5 minutes too.
    // The 50–70 minute lookahead window in the cron body is what
    // guarantees one fire per appointment — tighter than this and we
    // miss slots, looser and we add work without changing behavior.
    paths.push("/__cron/pre-visit-summary");

    // 2. Hourly tasks (bookings + post-visit summaries): run once an hour (between minute 5 and 10)
    if (utcMin >= 5 && utcMin < 10) {
      paths.push("/__cron/booking-reminders");
      paths.push("/__cron/post-visit-summary");
    }

    // 3. Daily tasks (refills + vaccinations): run once a day around 03:35 UTC (between minute 35 and 40)
    if (utcHour === 3 && utcMin >= 35 && utcMin < 40) {
      paths.push("/__cron/refill-reminders");
      paths.push("/__cron/vaccination-reminders");
    }

    // 4. Daily tasks (reclassify sweep): run once a day around 23:30 UTC (between minute 30 and 35)
    if (utcHour === 23 && utcMin >= 30 && utcMin < 35) {
      paths.push("/__cron/reclassify");
      // Day 5 #8: symptom-log anomaly detector. Scans last 7 days
      // for clusters of moderate/severe symptoms and fires a
      // notification + audit row. Cheap (one SELECT, tiny JS work).
      paths.push("/__cron/symptom-anomalies");
    }

    for (const path of paths) {
      const req = new Request(`http://localhost${path}`, {
        method: "POST",
        headers: {
          "x-cron-secret": env.CRON_SECRET || "",
        },
      });
      ctx.waitUntil(app.fetch(req, env, ctx));
    }
  },
} satisfies ExportedHandler<any>;

// Round 4: TeleconsultRoom Durable Object. CF requires DO classes to
// be named exports of the Worker module — the runtime looks them up
// by `class_name` from `wrangler.toml`'s [[durable_objects]] binding.
export { TeleconsultRoom };
