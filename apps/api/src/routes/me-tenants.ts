// @ts-nocheck
// Phase MTN-1: My tenants — tenant switcher endpoint.
//
// Returns the caller's hospital + clinic memberships so the mobile
// switcher can render its list without a second DB scan. Reads from
// the ContextVariableMap populated by tenantContextMiddleware.
//
// Endpoints:
//   GET    /me/tenants       list my hospitals + clinics
//   PATCH  /me/active-tenant { type: 'hospital'|'clinic', id: string|null }
//                            persists the durable column

import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { users } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import type { AppEnvironment } from "../types";

const router = new Hono<AppEnvironment>();
router.use("*", authMiddleware);

router.get("/tenants", async (c) => {
  const hospitals = c.get("myHospitals") || [];
  const clinics = c.get("myClinics") || [];
  const activeHospitalId = c.get("activeHospitalId") || null;
  const activeClinicId = c.get("activeClinicId") || null;
  return c.json(
    {
      hospitals,
      clinics,
      activeHospitalId,
      activeClinicId,
    },
    200
  );
});

const patchSchema = z.object({
  type: z.enum(["hospital", "clinic"]).nullable(),
  id: z.string().min(1).nullable(),
});

router.patch("/active-tenant", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = patchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: "Invalid body" }, 400);
  if ((body.data.type === null) !== (body.data.id === null)) {
    return c.json(
      { error: "type and id must both be set or both be null" },
      400
    );
  }
  await db
    .update(users)
    .set({
      activeTenantType: body.data.type,
      activeTenantId: body.data.id,
      updatedAt: sql`CURRENT_TIMESTAMP`,
    })
    .where(eq(users.id, userId));
  return c.json({ ok: true }, 200);
});

export default router;