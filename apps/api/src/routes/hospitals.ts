// @ts-nocheck

import { Hono } from "hono";
import { eq, like, or, and } from "drizzle-orm";
import { hospitals, users } from "@healthcare/db";
import { authMiddleware } from "../middleware/auth";
import type { AppEnvironment } from "../types";

const hospitalsRouter = new Hono<AppEnvironment>();

// ─── List all hospitals (patients use to find clinics) ───
hospitalsRouter.get("/", authMiddleware, async (c) => {
  const db = c.get("db");
  const query = c.req.query("q");

  const conditions = [] as any[];
  if (query && query.length >= 2) {
    const safe = query.replace(/[%_]/g, "\\$&");
    conditions.push(
      or(
        like(hospitals.name, `%${safe}%`),
        like(hospitals.address, `%${safe}%`)
      )
    );
  }

  const rows = await db
    .select()
    .from(hospitals)
    .innerJoin(users, eq(hospitals.userId, users.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(100);

  return c.json({
    hospitals: rows.map((r: any) => ({
      ...(r.hospitals || {}),
      email: r.users?.email,
    })),
  });
});

// ─── Hospital detail ─────────────────────────────────────
hospitalsRouter.get("/:id", authMiddleware, async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const [row] = await db
    .select()
    .from(hospitals)
    .innerJoin(users, eq(hospitals.userId, users.id))
    .where(eq(hospitals.id, id))
    .limit(1);

  if (!row) return c.json({ error: "Hospital not found" }, 404);

  return c.json({
    hospital: {
      ...(row.hospitals || {}),
      email: row.users?.email,
    },
  });
});

export default hospitalsRouter;