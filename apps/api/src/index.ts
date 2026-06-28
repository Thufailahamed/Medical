import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createDb } from "./lib/db";
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

// ─── 404 ─────────────────────────────────────────────────
app.notFound((c) => {
  return c.json({ error: "Not found" }, 404);
});

// ─── Error handler ───────────────────────────────────────
app.onError((err, c) => {
  console.error("API Error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
