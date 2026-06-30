import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb } from "./lib/db";
import { localeMiddleware } from "./middleware/locale";
import { familyContextMiddleware } from "./middleware/family-context";
import authRoutes from "./routes/auth";
import patientsRoutes from "./routes/patients";
import medicalRecordsRoutes from "./routes/medical-records";
import appointmentsRoutes from "./routes/appointments";
import emergencyRoutes from "./routes/emergency";
import aiRoutes from "./routes/ai";
import filesRoutes from "./routes/files";
import medicinesRouter from "./routes/medicines";
import doctorRouter from "./routes/doctor";
import notificationsRouter from "./routes/notifications";
import hospitalsRouter from "./routes/hospitals";
import vitalsRouter from "./routes/vitals";
import notesRouter from "./routes/notes";
import dosesRouter from "./routes/doses";
import auditRouter from "./routes/audit";
import insuranceRouter from "./routes/insurance";
import labsRouter from "./routes/labs";
import wellnessRouter from "./routes/wellness";
import doctorPortalRouter from "./routes/doctor-portal";
import hospitalPortalRouter from "./routes/hospital-portal";
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
import { handleInboundEmail } from "./email/inbound";
import { bookingRemindersRouter } from "./cron/booking-reminders";
import { doseRemindersRouter } from "./cron/dose-reminders";
import { refillRemindersRouter } from "./cron/refill-reminders";
import { reclassifyRouter } from "./cron/reclassify";
import { vaccinationRemindersRouter } from "./cron/vaccination-reminders";
import familyActiveRouter from "./routes/family-active";
import type { AppEnvironment } from "./types";

const app = new Hono<AppEnvironment>();

// ─── Global middleware ───────────────────────────────────
app.use("*", logger());
app.use("*", cors({
  origin: ["http://localhost:8081", "https://*.exp.host"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowHeaders: ["Content-Type", "Authorization"],
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
app.route("/emergency", emergencyRoutes);
app.route("/ai", aiRoutes);
app.route("/files", filesRoutes);
app.route("/medicines", medicinesRouter);
app.route("/doctor", doctorRouter);
app.route("/notifications", notificationsRouter);
app.route("/hospitals", hospitalsRouter);
app.route("/vitals", vitalsRouter);
app.route("/notes", notesRouter);
app.route("/doses", dosesRouter);
app.route("/audit", auditRouter);
app.route("/insurance", insuranceRouter);
app.route("/labs", labsRouter);
app.route("/wellness", wellnessRouter);
app.route("/doctor-portal", doctorPortalRouter);
app.route("/hospital-portal", hospitalPortalRouter);
app.route("/chat", chatRouter);
app.route("/allergies", allergiesRouter);
app.route("/vaccinations", vaccinationsRouter);
app.route("/family", familyActiveRouter);
app.route("/timeline", timelineRouter);
app.route("/health-summary", healthSummaryRouter);
app.route("/export", exportRouter);
app.route("/share", shareRouter);
app.route("/push", pushRouter);
app.route("/walk-ins", walkInsRouter);
// Phase 1.4: email alias read/rotate. Mounted at root with absolute paths
// because the existing patientsRouter catches `:id` which would shadow it.
app.route("/", emailRouter);
// Phase 2.1: AI auto-classify + trilingual FTS5 search.
app.route("/", classificationRouter);

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
app.route("/", bookingRemindersRouter);
app.route("/", doseRemindersRouter);
app.route("/", refillRemindersRouter);
app.route("/", reclassifyRouter);
app.route("/", vaccinationRemindersRouter);

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
} satisfies ExportedHandler<any>;
