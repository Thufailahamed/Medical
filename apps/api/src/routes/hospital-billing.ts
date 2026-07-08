// @ts-nocheck
// HOS-9: Billing routes. Mounted at /hospital-portal/billing.

import { Hono } from "hono";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  invoices,
  invoiceLineItems,
  payments,
  patients,
  users,
} from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import {
  invoiceCreateSchema,
  paymentSchema,
} from "@healthcare/shared";
import type { AppEnvironment } from "../types";
import { notify } from "../lib/notifications";
import { flattenTranslated } from "../lib/validation-error";
import { writeAudit } from "../lib/audit";

const billingRouter = new Hono<AppEnvironment>();

billingRouter.use(
  "*",
  authMiddleware,
  requireRole("hospital_admin", "hospital_staff", "super_admin")
);

async function resolveScopeId(c: any): Promise<string | null> {
  const db = c.get("db");
  const userId = c.get("userId");
  const headerId = c.req.header("x-active-hospital-id") || null;
  const middlewareId = c.get("activeHospitalId") || null;
  const id = headerId || middlewareId;
  if (id) return id;
  const { hospitals } = await import("@healthcare/db");
  if (c.get("userRole") === "super_admin") {
    const [h] = await db.select().from(hospitals).limit(1);
    return h?.id ?? null;
  }
  const [h] = await db.select().from(hospitals).where(eq(hospitals.userId, userId)).limit(1);
  return h?.id ?? null;
}

async function generateInvoiceNumber(db: any, hospitalId: string): Promise<string> {
  const year = new Date().getFullYear();
  const [{ n } = {}] = await db
    .select({ n: sql<number>`count(*)` })
    .from(invoices)
    .where(and(eq(invoices.hospitalId, hospitalId), sql`${invoices.invoiceNumber} like ${`INV-${year}-%`}`));
  const seq = String(Number(n ?? 0) + 1).padStart(5, "0");
  return `INV-${year}-${seq}`;
}

// GET /hospital-portal/billing/invoices
billingRouter.get("/invoices", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ invoices: [] });

  const status = c.req.query("status") || null;
  const patientId = c.req.query("patientId") || null;
  const from = c.req.query("from") || null;
  const to = c.req.query("to") || null;

  const whereParts: any[] = [eq(invoices.hospitalId, scopeId)];
  if (status) whereParts.push(eq(invoices.status, status));
  if (patientId) whereParts.push(eq(invoices.patientId, patientId));
  if (from) whereParts.push(sql`${invoices.createdAt} >= ${from}`);
  if (to) whereParts.push(sql`${invoices.createdAt} <= ${to}`);

  const rows = await db
    .select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      patientId: invoices.patientId,
      patientName: users.name,
      visitType: invoices.visitType,
      totalLkr: invoices.totalLkr,
      status: invoices.status,
      issuedAt: invoices.issuedAt,
      createdAt: invoices.createdAt,
    })
    .from(invoices)
    .innerJoin(patients, eq(patients.id, invoices.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(and(...whereParts))
    .orderBy(desc(invoices.createdAt));

  return c.json({ invoices: rows });
});

// GET /hospital-portal/billing/invoices/:id
billingRouter.get("/invoices/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);

  const lines = await db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
  const pays = await db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paidAt));

  const [patient] = await db
    .select({ id: patients.id, name: users.name, phone: users.phone })
    .from(patients)
    .innerJoin(users, eq(users.id, patients.userId))
    .where(eq(patients.id, inv.patientId))
    .limit(1);

  return c.json({ invoice: inv, lineItems: lines, payments: pays, patient });
});

// POST /hospital-portal/billing/invoices
billingRouter.post("/invoices", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json().catch(() => ({}));
  const parsed = invoiceCreateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ error: "No active hospital" }, 400);

  const subtotal = parsed.data.lineItems.reduce((acc, li) => acc + (li.amountLkr ?? li.quantity * li.unitPriceLkr), 0);
  const total = subtotal + (parsed.data.taxLkr ?? 0) - (parsed.data.discountLkr ?? 0);
  const invoiceNumber = await generateInvoiceNumber(db, scopeId);

  const [created] = await db
    .insert(invoices)
    .values({
      hospitalId: scopeId,
      patientId: parsed.data.patientId,
      admissionId: parsed.data.admissionId ?? null,
      appointmentId: parsed.data.appointmentId ?? null,
      walkInId: parsed.data.walkInId ?? null,
      visitType: parsed.data.visitType ?? "opd",
      invoiceNumber,
      subtotalLkr: subtotal,
      taxLkr: parsed.data.taxLkr ?? 0,
      discountLkr: parsed.data.discountLkr ?? 0,
      totalLkr: total,
      status: "draft",
      notes: parsed.data.notes ?? null,
      createdByUserId: userId,
    })
    .returning();

  for (const li of parsed.data.lineItems) {
    await db.insert(invoiceLineItems).values({
      invoiceId: created.id,
      description: li.description,
      quantity: li.quantity,
      unitPriceLkr: li.unitPriceLkr,
      amountLkr: li.amountLkr ?? li.quantity * li.unitPriceLkr,
      kind: li.kind ?? "other",
      refRecordId: li.refRecordId ?? null,
      refPrescriptionId: li.refPrescriptionId ?? null,
      refLabOrderId: li.refLabOrderId ?? null,
    });
  }

  await writeAudit(db, userId, "invoice.create", { id: created.id });
  return c.json({ invoice: created }, 201);
});

// PATCH /hospital-portal/billing/invoices/:id
billingRouter.patch("/invoices/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  if (inv.status !== "draft") return c.json({ error: "Only draft invoices can be edited" }, 400);

  const updates: any = {};
  if (typeof body.taxLkr === "number") updates.taxLkr = body.taxLkr;
  if (typeof body.discountLkr === "number") updates.discountLkr = body.discountLkr;
  if (typeof body.notes === "string") updates.notes = body.notes;
  if (typeof body.dueAt === "string") updates.dueAt = body.dueAt;
  if (Array.isArray(body.lineItems)) {
    await db.delete(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id));
    const subtotal = body.lineItems.reduce((acc: number, li: any) => acc + (li.amountLkr ?? li.quantity * li.unitPriceLkr), 0);
    for (const li of body.lineItems) {
      await db.insert(invoiceLineItems).values({
        invoiceId: id,
        description: li.description,
        quantity: li.quantity,
        unitPriceLkr: li.unitPriceLkr,
        amountLkr: li.amountLkr ?? li.quantity * li.unitPriceLkr,
        kind: li.kind ?? "other",
      });
    }
    updates.subtotalLkr = subtotal;
    updates.totalLkr = subtotal + (updates.taxLkr ?? inv.taxLkr) - (updates.discountLkr ?? inv.discountLkr);
  }

  await db.update(invoices).set(updates).where(eq(invoices.id, id));
  return c.json({ ok: true });
});

// POST /hospital-portal/billing/invoices/:id/issue
billingRouter.post("/invoices/:id/issue", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);
  if (inv.status !== "draft") return c.json({ error: "Invoice already issued" }, 400);
  const now = new Date().toISOString();
  await db.update(invoices).set({ status: "issued", issuedAt: now }).where(eq(invoices.id, id));
  await notify(db, inv.patientId, "invoice_issued", { invoiceId: id, total: inv.totalLkr });
  return c.json({ ok: true });
});

// POST /hospital-portal/billing/invoices/:id/cancel
billingRouter.post("/invoices/:id/cancel", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  await db.update(invoices).set({ status: "cancelled" }).where(eq(invoices.id, id));
  return c.json({ ok: true });
});

// POST /hospital-portal/billing/invoices/:id/payments
billingRouter.post("/invoices/:id/payments", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const parsed = paymentSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: "Validation failed", details: flattenTranslated(parsed.error) }, 400);

  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);

  await db.insert(payments).values({
    invoiceId: id,
    amountLkr: parsed.data.amountLkr,
    method: parsed.data.method ?? "cash",
    reference: parsed.data.reference ?? null,
    receivedByUserId: userId,
    notes: parsed.data.notes ?? null,
  });

  const [{ paid } = {}] = await db
    .select({ paid: sql<number>`coalesce(sum(${payments.amountLkr}),0)` })
    .from(payments)
    .where(eq(payments.invoiceId, id));
  const total = Number(inv.totalLkr);
  const paidTotal = Number(paid ?? 0);
  const next = paidTotal >= total ? "paid" : paidTotal > 0 ? "partially_paid" : inv.status;
  await db.update(invoices).set({ status: next }).where(eq(invoices.id, id));

  await writeAudit(db, userId, "payment.create", { invoiceId: id, amount: parsed.data.amountLkr });
  return c.json({ ok: true, status: next, paidTotal, total });
});

// GET /hospital-portal/billing/invoices/:id/receipt
billingRouter.get("/invoices/:id/receipt", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const [inv] = await db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
  if (!inv) return c.json({ error: "Invoice not found" }, 404);

  const [pays, lines, patient] = await Promise.all([
    db.select().from(payments).where(eq(payments.invoiceId, id)).orderBy(desc(payments.paidAt)),
    db.select().from(invoiceLineItems).where(eq(invoiceLineItems.invoiceId, id)),
    (async () => {
      const [p] = await db
        .select({ id: patients.id, name: users.name, phone: users.phone })
        .from(patients)
        .innerJoin(users, eq(users.id, patients.userId))
        .where(eq(patients.id, inv.patientId))
        .limit(1);
      return p;
    })(),
  ]);

  const totalPaid = pays.reduce((a, p) => a + p.amountLkr, 0);
  return c.json({ invoice: inv, lines, payments: pays, patient, totalPaid });
});

// GET /hospital-portal/billing/outstanding
billingRouter.get("/outstanding", async (c) => {
  const db = c.get("db");
  const scopeId = await resolveScopeId(c);
  if (!scopeId) return c.json({ rows: [] });

  const rows = await db
    .select({
      patientId: invoices.patientId,
      patientName: users.name,
      outstanding: sql<number>`sum(${invoices.totalLkr})`.as("outstanding"),
      invoiceCount: sql<number>`count(${invoices.id})`.as("invoiceCount"),
    })
    .from(invoices)
    .innerJoin(patients, eq(patients.id, invoices.patientId))
    .innerJoin(users, eq(users.id, patients.userId))
    .where(
      and(
        eq(invoices.hospitalId, scopeId),
        sql`${invoices.status} in ('issued','partially_paid')`
      )
    )
    .groupBy(invoices.patientId, users.name);
  return c.json({ rows });
});

export default billingRouter;