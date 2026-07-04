# Test harness

Critical-path tests for the healthcare API. Each test exercises one
behaviour we cannot ship without.

## Layout

| File                          | Coverage                                                |
| ----------------------------- | ------------------------------------------------------- |
| `access.test.ts`              | `canAccessPatient` + `accessiblePatientsFor`            |
| `status-guard.test.ts`        | `upsertActiveCareTeam` idempotency + error propagation  |
| `care-team.test.ts`           | `/care-team` POST / PATCH / invites / reverse           |
| `_mockDb.ts`                  | In-memory fluent Drizzle mock                           |
| `_testApp.ts`                 | Hono app builder with stub auth + JWT helper            |
| `setup.ts`                    | vitest setup (currently empty)                          |

## Run

From repo root:

```sh
bun run test              # one-shot
bun run test:watch        # watch mode
bun run test:coverage     # with v8 coverage
```

Or from `apps/api/`:

```sh
bun run test
```

## How it works

`_mockDb.ts` implements the slice of the Drizzle API the routes
actually use:

- `db.select(spec).from(t).where(pred).innerJoin(t2, on).orderBy(col).limit(n)`
- `db.selectDistinct(spec)…` (used by `accessiblePatientsFor`)
- `db.insert(t).values(row).returning()`
- `db.update(t).set(patch).where(pred).returning()`
- `db.delete(t).where(pred).returning()`
- `db.transaction(async (tx) => …)` — snapshot + rollback

Two ways to satisfy a `where` predicate:

1. **Test-controlled** — call `mockDb.setWhere("table_name", fn)` before
   issuing the request. The mock consumes one predicate per query.
2. **Auto-derived** — when the route passes a Drizzle `eq()` /
   `and()` / `or()` / `inArray()` expression, the mock walks the
   `queryChunks` and builds a row predicate from the column refs.
   Falls back to setWhere if no parseable expression.

Select projections: the mock handles `{alias: columnRef}` specs by
resolving the column to the row's camelCase key via the table's
`Symbol(drizzle:Columns)` map. Joined tables are merged into the
output row using the eq conditions from `innerJoin()` — so spec keys
referring to joined tables (e.g. `patientName: users.name`) resolve
transparently.

## Why not real D1

Day-1 scope is unit + route smoke tests. The mock runs the full suite
in under 500ms and works in any CI without the workerd / miniflare
harness. Real D1 integration (insert via Drizzle against miniflare,
read back, assert) is the next step once we have schema parity
problems to debug.
