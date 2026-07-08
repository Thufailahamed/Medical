// @ts-nocheck
// HOS-10: Reports & analytics. Mounted at /hospital-portal/reports.

import { Hono } from "hono";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import {
  appointments,
  walkIns,
  admissions,
  invoices,
  payments,
  labOrders,
  prescriptions,
  beds,
  wards,
  patients,
  medicalRecords,
  hospitals,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const reportsRouter = new Hono<AppEnvironment>();

reportsRouter.use(
  "*",
  authMiddleware,
  requireRole("hospital_admin", "hospital_staff", "super_admin")
);

async function resolveScopeId(c: any): Promise<string | null> {
  const db = c.get("db");
  const headerId = c.req.header("x-active-hospital-id") || null;
  const middlewareId = c.get("activeHospitalId") || null;
  const id = headerId || middlewareId;
  if (id) return id;
  const userId = c.get("userId");
  if (c.get("userRole") === "super_admin") {
    const [h] = await db.select().from(hospitals).limit(1);
    return h?.id ?? null;
  }
  const [h] = await db.select().from(hospitals).where(eq(hospitals.userId, userId)).limit(1);
  return h?.id ?? null;
}

function range(c: any): { from: string; to: string } {
  const to = c.req.query("to") || new Date().toISOString().slice(0, 10);
  const from = c.req.query("from") || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return { from, to };
}

// GET /hospital-portal/reports/opd?from=&to=
reportsRouter.get("/opd", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ days: [] });
  const { from, to } = range(c);

  const rows = await db
    .select({
      date: appointments.date,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(appointments)
    .where(and(eq(appointments.hospitalId, scopeId), gte(appointments.date, from), lte(appointments.date, to)))
    .groupBy(appointments.date);
  return c.json({ days: rows });
});

// GET /hospital-portal/reports/ipd?from=&to=
reportsRouter.get("/ipd", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ admitted: [], discharged: [], transferred: [] });
  const { from, to } = range(c);
  const baseWhere = and(eq(admissions.hospitalId, scopeId), gte(admissions.admittedAt, from));
  const [admitted, discharged, transferred] = await Promise.all([
    db
      .select({ d: sql<string>`substr(${admissions.admittedAt},1,10)`, n: sql<number>`count(*)` })
      .from(admissions)
      .where(baseWhere)
      .groupBy(sql`substr(${admissions.admittedAt},1,10)`),
    db
      .select({ d: sql<string>`substr(${admissions.dischargedAt},1,10)`, n: sql<number>`count(*)` })
      .from(admissions)
      .where(and(eq(admissions.hospitalId, scopeId), sql`${admissions.dischargedAt} is not null`, gte(admissions.dischargedAt, from)))
      .groupBy(sql`substr(${admissions.dischargedAt},1,10)`),
    db
      .select({ d: sql<string>`substr(${admissions.admittedAt},1,10)`, n: sql<number>`count(*)` })
      .from(admissions)
      .where(and(eq(admissions.hospitalId, scopeId), eq(admissions.status, "transferred"), gte(admissions.admittedAt, from)))
      .groupBy(sql`substr(${admissions.admittedAt},1,10)`),
  ]);
  return c.json({ admitted, discharged, transferred });
});

// GET /hospital-portal/reports/occupancy?from=&to=
reportsRouter.get("/occupancy", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ wards: [] });
  const wardRows = await db
    .select({ id: wards.id, name: wards.name, total: sql<number>`count(${beds.id})`.as("total") })
    .from(wards)
    .leftJoin(beds, eq(beds.wardId, wards.id))
    .where(eq(wards.hospitalId, scopeId))
    .groupBy(wards.id, wards.name);

  // For MVP we report current occupancy, not historical.
  const enriched: any[] = [];
  for (const w of wardRows) {
    const [occ] = await db
      .select({ n: sql<number>`count(*)`.as("n") })
      .from(beds)
      .where(and(eq(beds.wardId, w.id), eq(beds.status, "occupied")));
    enriched.push({ ...w, occupied: Number(occ?.n ?? 0) });
  }
  return c.json({ wards: enriched });
});

// GET /hospital-portal/reports/revenue?from=&to=&granularity=
reportsRouter.get("/revenue", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ series: [], total: 0 });
  const { from, to } = range(c);
  const granularity = c.req.query("granularity") || "daily";
  const trunc = granularity === "monthly" ? "7" : granularity === "weekly" ? "4" : "10";

  const rows = await db
    .select({
      bucket: sql<string>`substr(${payments.paidAt},1,${sql.raw(trunc)})`,
      total: sql<number>`sum(${payments.amountLkr})`.as("total"),
    })
    .from(payments)
    .innerJoin(invoices, eq(invoices.id, payments.invoiceId))
    .where(and(eq(invoices.hospitalId, scopeId), gte(payments.paidAt, from), lte(payments.paidAt, `${to} 23:59:59`)))
    .groupBy(sql`bucket`);

  const total = rows.reduce((a, r) => a + Number(r.total), 0);
  return c.json({ series: rows, total });
});

// GET /hospital-portal/reports/revenue/by-department
reportsRouter.get("/revenue/by-department", async (c) => {
  // Without department FK on invoices this is a stub — returns top-level split.
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ rows: [] });
  const rows = await db
    .select({
      visitType: invoices.visitType,
      total: sql<number>`sum(${invoices.totalLkr})`.as("total"),
    })
    .from(invoices)
    .where(and(eq(invoices.hospitalId, scopeId)))
    .groupBy(invoices.visitType);
  return c.json({ rows });
});

// GET /hospital-portal/reports/doctor-utilization?from=&to=
reportsRouter.get("/doctor-utilization", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ rows: [] });
  const { from, to } = range(c);
  const rows = await db
    .select({ doctorId: appointments.doctorId, count: sql<number>`count(*)`.as("count") })
    .from(appointments)
    .where(and(eq(appointments.hospitalId, scopeId), gte(appointments.date, from), lte(appointments.date, to)))
    .groupBy(appointments.doctorId);
  return c.json({ rows });
});

// GET /hospital-portal/reports/pharmacy?from=&to=
reportsRouter.get("/pharmacy", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ days: [] });
  const { from, to } = range(c);
  const rows = await db
    .select({
      d: sql<string>`substr(${prescriptions.dispensedAt},1,10)`,
      n: sql<number>`count(*)`.as("n"),
    })
    .from(prescriptions)
    .where(
      and(
        eq(prescriptions.hospitalId, scopeId),
        eq(prescriptions.status, "dispensed"),
        gte(prescriptions.dispensedAt, from),
        lte(prescriptions.dispensedAt, `${to} 23:59:59`)
      )
    )
    .groupBy(sql`substr(${prescriptions.dispensedAt},1,10)`);
  return c.json({ days: rows });
});

// GET /hospital-portal/reports/top-diagnoses?from=&to=&limit=
reportsRouter.get("/top-diagnoses", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ rows: [] });
  const { from, to } = range(c);
  const limit = Math.min(50, Math.max(1, parseInt(c.req.query("limit") || "10", 10)));
  const rows = await db
    .select({
      diagnosis: medicalRecords.body,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(medicalRecords)
    .where(
      and(
        eq(medicalRecords.hospitalId, scopeId),
        gte(medicalRecords.date, from),
        lte(medicalRecords.date, `${to} 23:59:59`)
      )
    )
    .groupBy(medicalRecords.body)
    .orderBy(desc(sql`count`))
    .limit(limit);
  return c.json({ rows });
});

// GET /hospital-portal/reports/dashboard-tiles
reportsRouter.get("/dashboard-tiles", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ tiles: [] });

  const todayIso = new Date().toISOString().slice(0, 10);
  const [opdRow, ipdRow, occRow, labRow, rxRow, walkRow, paidRow] = await Promise.all([
    db.select({ n: sql<number>`count(*)` }).from(appointments).where(and(eq(appointments.hospitalId, scopeId), eq(appointments.date, todayIso))),
    db.select({ n: sql<number>`count(*)` }).from(admissions).where(and(eq(admissions.hospitalId, scopeId), eq(admissions.status, "admitted"))),
    db.select({ total: sql<number>`count(*)`, occ: sql<number>`sum(case when ${beds.status}='occupied' then 1 else 0 end)` }).from(beds).innerJoin(wards, eq(wards.id, beds.wardId)).where(eq(wards.hospitalId, scopeId)),
    db.select({ n: sql<number>`count(*)` }).from(labOrders).where(and(eq(labOrders.hospitalId, scopeId), sql`${labOrders.status} in ('ordered','sample_collected','in_progress')`)),
    db.select({ n: sql<number>`count(*)` }).from(prescriptions).where(and(eq(prescriptions.hospitalId, scopeId), eq(prescriptions.status, "signed"))),
    db.select({ n: sql<number>`count(*)` }).from(walkIns).where(and(eq(walkIns.hospitalId, scopeId), eq(walkIns.status, "waiting"))),
    db.select({ total: sql<number>`coalesce(sum(${payments.amountLkr}),0)` }).from(payments).innerJoin(invoices, eq(invoices.id, payments.invoiceId)).where(and(eq(invoices.hospitalId, scopeId), gte(payments.paidAt, `${todayIso} 00:00:00`), lte(payments.paidAt, `${todayIso} 23:59:59`))),
  ]);

  return c.json({
    tiles: [
      { key: "opdToday", value: Number(opdRow[0]?.n ?? 0) },
      { key: "ipdCensus", value: Number(ipdRow[0]?.n ?? 0) },
      { key: "beds", value: Number(occRow[0]?.occ ?? 0), total: Number(occRow[0]?.total ?? 0) },
      { key: "pendingLabs", value: Number(labRow[0]?.n ?? 0) },
      { key: "pendingRx", value: Number(rxRow[0]?.n ?? 0) },
      { key: "walkInsWaiting", value: Number(walkRow[0]?.n ?? 0) },
      { key: "revenueToday", value: Number(paidRow[0]?.total ?? 0) },
    ],
  });
});

export default reportsRouter;