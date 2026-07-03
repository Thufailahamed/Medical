// @ts-nocheck

import { Hono } from "hono";
import { and, eq, gte, lt, sql, desc } from "drizzle-orm";
import {
  doctorRevenueEvents,
  doctorPayouts,
  doctors,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import type { AppEnvironment } from "../types";

const doctorEarningsRouter = new Hono<AppEnvironment>();

doctorEarningsRouter.use("*", authMiddleware, requireRole("doctor"));

async function getDoctor(db: any, userId: string) {
  const [d] = await db
    .select()
    .from(doctors)
    .where(eq(doctors.userId, userId))
    .limit(1);
  return d;
}

function periodBounds(period: string): { start: string; end: string; prevStart: string; prevEnd: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + n);
    return x;
  };

  let start: string, end: string;
  if (period === "week") {
    start = fmt(addDays(now, -7));
    end = today;
  } else if (period === "month") {
    start = fmt(addDays(now, -30));
    end = today;
  } else if (period === "quarter") {
    start = fmt(addDays(now, -90));
    end = today;
  } else if (period === "year") {
    start = fmt(addDays(now, -365));
    end = today;
  } else {
    start = fmt(addDays(now, -30));
    end = today;
  }

  const startDate = new Date(start + "T00:00:00Z");
  const endDate = new Date(end + "T00:00:00Z");
  const span = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const prevStart = fmt(addDays(startDate, -span));
  const prevEnd = start;

  return { start, end, prevStart, prevEnd };
}

// ─── Summary ──────────────────────────────────────────────
// GET /doctor-earnings/summary?period=week|month|quarter|year
doctorEarningsRouter.get("/summary", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const period = (c.req.query("period") || "month").toLowerCase();
  const { start, end, prevStart, prevEnd } = periodBounds(period);

  const cur = await db
    .select({
      total: sql<number>`coalesce(sum(${doctorRevenueEvents.amountLkr}), 0)`.as("total"),
      count: sql<number>`count(*)`.as("count"),
      avg: sql<number>`coalesce(avg(${doctorRevenueEvents.amountLkr}), 0)`.as("avg"),
    })
    .from(doctorRevenueEvents)
    .where(
      and(
        eq(doctorRevenueEvents.doctorId, doctor.id),
        gte(doctorRevenueEvents.occurredAt, `${start} 00:00:00`),
        lt(doctorRevenueEvents.occurredAt, `${end} 23:59:59`)
      )
    );

  const prev = await db
    .select({
      total: sql<number>`coalesce(sum(${doctorRevenueEvents.amountLkr}), 0)`.as("total"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(doctorRevenueEvents)
    .where(
      and(
        eq(doctorRevenueEvents.doctorId, doctor.id),
        gte(doctorRevenueEvents.occurredAt, `${prevStart} 00:00:00`),
        lt(doctorRevenueEvents.occurredAt, `${prevEnd} 23:59:59`)
      )
    );

  const total = Number(cur[0]?.total ?? 0);
  const prevTotal = Number(prev[0]?.total ?? 0);
  const count = Number(cur[0]?.count ?? 0);
  const avg = Number(cur[0]?.avg ?? 0);
  const trendPct =
    prevTotal > 0 ? ((total - prevTotal) / prevTotal) * 100 : total > 0 ? 100 : 0;

  // Pending payouts total
  const pendingRow = await db
    .select({ total: sql<number>`coalesce(sum(${doctorPayouts.amountLkr}), 0)` })
    .from(doctorPayouts)
    .where(
      and(
        eq(doctorPayouts.doctorId, doctor.id),
        eq(doctorPayouts.status, "pending")
      )
    );

  return c.json({
    period,
    start,
    end,
    totalLkr: total,
    visitCount: count,
    avgPerVisitLkr: avg,
    previousPeriod: { start: prevStart, end: prevEnd, totalLkr: prevTotal },
    trendPct: Math.round(trendPct * 10) / 10,
    pendingPayoutLkr: Number(pendingRow[0]?.total ?? 0),
    consultationFee: (doctor as any).consultationFee ?? 0,
  });
});

// ─── Time-series for chart ───────────────────────────────
// GET /doctor-earnings/timeseries?from=&to=&bucket=day|week
doctorEarningsRouter.get("/timeseries", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const from = c.req.query("from") || "";
  const to = c.req.query("to") || "";
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    return c.json({ error: "from/to must be YYYY-MM-DD" }, 400);
  }
  const bucket = c.req.query("bucket") === "week" ? "week" : "day";

  // Group by date substring (YYYY-MM-DD). For week we'd want a different
  // truncation; v1 keeps day bucketing and lets the client aggregate
  // into weeks for longer ranges.
  const rows = await db
    .select({
      bucket: sql<string>`substr(${doctorRevenueEvents.occurredAt}, 1, 10)`.as("bucket"),
      total: sql<number>`coalesce(sum(${doctorRevenueEvents.amountLkr}), 0)`.as("total"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(doctorRevenueEvents)
    .where(
      and(
        eq(doctorRevenueEvents.doctorId, doctor.id),
        gte(doctorRevenueEvents.occurredAt, `${from} 00:00:00`),
        lt(doctorRevenueEvents.occurredAt, `${to} 23:59:59`)
      )
    )
    .groupBy(sql`substr(${doctorRevenueEvents.occurredAt}, 1, 10)`)
    .orderBy(sql`substr(${doctorRevenueEvents.occurredAt}, 1, 10)`);

  return c.json({
    bucket,
    from,
    to,
    series: rows.map((r: any) => ({
      bucket: r.bucket,
      total: Number(r.total || 0),
      count: Number(r.count || 0),
    })),
  });
});

// ─── Payout history ───────────────────────────────────────
// GET /doctor-earnings/payouts?limit=20
doctorEarningsRouter.get("/payouts", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const limit = Math.min(
    parseInt(c.req.query("limit") || "20", 10) || 20,
    100
  );

  const rows = await db
    .select()
    .from(doctorPayouts)
    .where(eq(doctorPayouts.doctorId, doctor.id))
    .orderBy(desc(doctorPayouts.createdAt))
    .limit(limit);

  return c.json({ payouts: rows });
});

// ─── Request payout ───────────────────────────────────────
// POST /doctor-earnings/payouts  { periodStart, periodEnd }
// Groups unassigned revenue events into a new payout row with status=pending.
doctorEarningsRouter.post("/payouts", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);

  const body = await c.req.json().catch(() => ({}));
  const periodStart = String(body?.periodStart || "").trim();
  const periodEnd = String(body?.periodEnd || "").trim();
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(periodStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(periodEnd)
  ) {
    return c.json(
      { error: "periodStart + periodEnd (YYYY-MM-DD) required" },
      400
    );
  }
  if (periodEnd <= periodStart) {
    return c.json({ error: "periodEnd must be after periodStart" }, 400);
  }

  // Aggregate unassigned events in the window.
  const agg = await db
    .select({
      total: sql<number>`coalesce(sum(${doctorRevenueEvents.amountLkr}), 0)`.as("total"),
      count: sql<number>`count(*)`.as("count"),
    })
    .from(doctorRevenueEvents)
    .where(
      and(
        eq(doctorRevenueEvents.doctorId, doctor.id),
        sql`${doctorRevenueEvents.payoutId} IS NULL`,
        gte(doctorRevenueEvents.occurredAt, `${periodStart} 00:00:00`),
        lt(doctorRevenueEvents.occurredAt, `${periodEnd} 23:59:59`)
      )
    );

  const amountLkr = Number(agg[0]?.total || 0);
  const eventCount = Number(agg[0]?.count || 0);
  if (eventCount === 0) {
    return c.json({ error: "No revenue events in this window" }, 400);
  }

  const [payout] = await db
    .insert(doctorPayouts)
    .values({
      doctorId: doctor.id,
      periodStart,
      periodEnd,
      amountLkr,
      eventCount,
      status: "pending",
    } as any)
    .returning();

  // Attach events to this payout.
  await db
    .update(doctorRevenueEvents)
    .set({ payoutId: payout.id })
    .where(
      and(
        eq(doctorRevenueEvents.doctorId, doctor.id),
        sql`${doctorRevenueEvents.payoutId} IS NULL`,
        gte(doctorRevenueEvents.occurredAt, `${periodStart} 00:00:00`),
        lt(doctorRevenueEvents.occurredAt, `${periodEnd} 23:59:59`)
      )
    );

  return c.json({ payout }, 201);
});

// ─── Update payout (admin hook) ──────────────────────────
// PATCH /doctor-earnings/payouts/:id  { status, reference? }
doctorEarningsRouter.patch("/payouts/:id", async (c) => {
  const userId = c.get("userId");
  const db = c.get("db");
  const doctor = await getDoctor(db, userId);
  if (!doctor) return c.json({ error: "Doctor profile not found" }, 404);
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));

  const allowed = ["pending", "paid", "failed"];
  const status = String(body.status || "");
  if (!allowed.includes(status)) {
    return c.json({ error: `status must be one of: ${allowed.join(", ")}` }, 400);
  }

  const [own] = await db
    .select()
    .from(doctorPayouts)
    .where(
      and(eq(doctorPayouts.id, id), eq(doctorPayouts.doctorId, doctor.id))
    )
    .limit(1);
  if (!own) return c.json({ error: "Payout not found" }, 404);

  const updates: any = { status };
  if (body.reference !== undefined) updates.reference = String(body.reference);
  if (status === "paid") updates.paidAt = new Date().toISOString();

  const [updated] = await db
    .update(doctorPayouts)
    .set(updates)
    .where(eq(doctorPayouts.id, id))
    .returning();

  return c.json({ payout: updated });
});

export default doctorEarningsRouter;
