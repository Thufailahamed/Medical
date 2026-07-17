// tests/_mockDb.ts
//
// Tiny in-memory mock that implements the slice of the Drizzle API the
// code in apps/api actually uses. Tests seed rows via `mockDb.seed(...)`
// and can verify writes via `mockDb.tables.<table>` after each call.
//
// Why not @cloudflare/vitest-pool-workers: day-1 scope is unit + route
// smoke tests, not real-D1 integration. Mock keeps the suite under 5s
// and CI-friendly on any laptop. Swap behind the same `bun test`
// interface in week 2+ if we want real-D1 assertions.
//
// Coverage of Drizzle surface we implement:
//   - db.select(spec).from(t).where(pred).innerJoin(t2, on).orderBy(col).limit(n)
//   - db.select(spec).from(t).where(pred)  // promise of array
//   - db.insert(t).values(row).returning()
//   - db.update(t).set(patch).where(pred).returning()
//   - db.delete(t).where(pred).returning()
//   - db.transaction(async (tx) => ...)
//   - .groupBy(col)
//
// `pred` is the Drizzle SQL expression passed to where(). We can't
// evaluate SQL, so each query carries an optional `where` predicate
// function the test sets via `mockDb.expectWhere(predFn)` — if no
// predicate is registered, rows pass through unfiltered.

type Row = Record<string, any>;

type TableState = {
  rows: Row[];
  // Insert order tracking for stable cursor reads.
  insertSeq: number;
  // Auto-incrementing id generator (caller can override per-row).
  nextId: number;
};

type PendingQuery = {
  table?: string;
  joins?: Array<{ table: string; on?: any }>;
  predicate?: (row: any) => boolean;
  groupByField?: string;
  orderBy?: { field: string; desc: boolean };
  limitN?: number;
  offsetN?: number;
};

class MockD1 {
  // Tables storage — keys are normalized to camelCase. Exposed via
  // a Proxy so legacy snake_case access (db.tables["care_team_members"])
  // also works for backwards compat with existing tests.
  private _tables: Record<string, TableState> = {};
  get tables(): Record<string, TableState> {
    return new Proxy(this._tables, {
      get: (_t, key: string) => {
        if (typeof key !== "string") return undefined;
        const camel = toCamel(key);
        return this._tables[camel] ?? this._tables[key];
      },
      has: (_t, key: string) => {
        if (typeof key !== "string") return false;
        const camel = toCamel(key);
        return camel in this._tables || key in this._tables;
      },
      ownKeys: (_t) => Reflect.ownKeys(this._tables),
      getOwnPropertyDescriptor: (_t, key) => {
        if (typeof key !== "string") return undefined;
        const camel = toCamel(key);
        const real = this._tables[camel] ?? this._tables[key];
        if (!real) return undefined;
        return {
          enumerable: true,
          configurable: true,
          value: real,
          writable: true,
        };
      },
    }) as any;
  }
  // Pending where-predicate registrations, keyed by table.
  private predicates = new Map<string, Array<(row: any) => boolean>>();
  // Capture latest WHERE per (table, op) so the resolver can apply.
  private latestWhere = new Map<string, (row: any) => boolean>();
  // Last-error throw for unique-constraint simulation.
  private throwOnInsert: ((table: string, row: Row) => Error | null) | null = null;
  // Field combinations that must be unique per table (mirrors Drizzle
  // UNIQUE / partial UNIQUE indexes). On insert we check existing rows
  // and throw if any match the inserted values on these fields.
  private uniqueOn: Map<string, Array<{ fields: string[]; partialStatus?: string }>> = new Map();

  seed(table: string, rows: Row[] | Row) {
    const camel = toCamel(table);
    if (!this._tables[camel]) {
      this._tables[camel] = { rows: [], insertSeq: 0, nextId: 1 };
    }
    const arr = Array.isArray(rows) ? rows : [rows];
    for (const r of arr) {
      this._tables[camel].rows.push({ ...r });
      this._tables[camel].insertSeq++;
    }
  }

  setWhere(table: string, predicate: (row: any) => boolean) {
    // Normalise to camelCase so lookups against `_tableName()` resolve.
    this.latestWhere.set(toCamel(table), predicate);
  }

  // Make the next insert into `table` throw `err`. Mirrors Drizzle's
  // UNIQUE-constraint rejection in SQLite.
  failNextInsert(table: string, err: Error) {
    const camel = toCamel(table);
    this.throwOnInsert = (t, row) => (t === camel || t === table ? err : null);
  }

  // Register a uniqueness rule on `table`. When inserting a row into
  // `table`, if any existing row already has the same values for
  // `fields` (and optionally matches `partialStatus` on its status
  // column), throw a UNIQUE-constraint error to mirror SQLite.
  //   db.setUniqueOn("hospitalDoctors", ["hospitalId", "doctorId"])
  //   db.setUniqueOn("careTeamMembers",
  //                  ["patientId", "doctorId", "role"],
  //                  { partialStatus: "active" })
  setUniqueOn(
    table: string,
    fields: string[],
    opts: { partialStatus?: string } = {}
  ) {
    const camel = toCamel(table);
    const existing = this.uniqueOn.get(camel) ?? [];
    existing.push({ fields, partialStatus: opts.partialStatus });
    this.uniqueOn.set(camel, existing);
  }

  // ─── Drizzle surface ────────────────────────────────────
  select(spec?: any) {
    return new SelectBuilder(this, spec);
  }
  // `selectDistinct` is a thin wrapper around select — for the mock
  // we just return another builder that applies the same predicate
  // + filters. Distinctness is enforced by the route caller (it
  // groups by pid), so we don't need to dedupe at this layer.
  selectDistinct(spec?: any) {
    return new SelectBuilder(this, spec);
  }
  insert(table: any) {
    return new InsertBuilder(this, table);
  }
  update(table: any) {
    return new UpdateBuilder(this, table);
  }
  delete(table: any) {
    return new DeleteBuilder(this, table);
  }
  async transaction<T>(fn: (tx: MockD1) => Promise<T>): Promise<T> {
    // Snapshot tables for rollback on throw.
    const snapshot = JSON.parse(JSON.stringify(this.tables));
    try {
      return await fn(this);
    } catch (err) {
      this.tables = snapshot;
      throw err;
    }
  }

  // Internal helpers consumed by builders.
  _resolveWhere(table: string): ((row: any) => boolean) | undefined {
    const latest = this.latestWhere.get(table);
    if (latest) {
      this.latestWhere.delete(table);
      return latest;
    }
    return undefined;
  }
  _tableName(table: any): string {
    // Drizzle tables expose the table name via the Symbol(drizzle:Name)
    // own-property symbol. The original sqliteTable API used `._.name`
    // but newer drizzle-orm (>=0.31) moved it to a well-known symbol.
    const syms = Object.getOwnPropertySymbols(table ?? {});
    for (const s of syms) {
      if (String(s).includes("drizzle:Name")) {
        return toCamel(table[s] as string);
      }
    }
    // Last-resort heuristics for stub test tables.
    const raw =
      table?._?.name ?? table?.name ?? table?.tableName ?? String(table);
    return toCamel(String(raw));
  }
  _maybeThrowInsert(table: string, row: Row) {
    if (this.throwOnInsert) {
      const err = this.throwOnInsert(table, row);
      if (err) {
        // One-shot: clear so next insert succeeds.
        this.throwOnInsert = null;
        throw err;
      }
    }
    const rules = this.uniqueOn.get(table);
    if (rules && rules.length && (this as any)._tables[table]) {
      const state = (this as any)._tables[table];
      for (const r of rules) {
        // Partial UNIQUE only applies when the inserted row carries
        // the partialStatus (e.g. status='active'). Rows outside the
        // partial set never clash.
        if (r.partialStatus && row.status !== r.partialStatus) continue;
        const clash = state.rows.find((existing: any) => {
          if (r.partialStatus && existing.status !== r.partialStatus) {
            return false;
          }
          for (const f of r.fields) {
            if (existing[f] !== row[f]) return false;
          }
          return true;
        });
        if (clash) {
          throw new Error(
            `UNIQUE constraint failed: ${table}_${r.fields.join("_")}`
          );
        }
      }
    }
  }
}

class SelectBuilder {
  private q: PendingQuery = {};
  private spec: any = undefined;
  constructor(private db: MockD1, spec?: any) {
    this.spec = spec;
  }
  from(table: any) {
    this.q.table = this.db._tableName(table);
    return this;
  }
  innerJoin(table: any, _on?: any) {
    this.q.joins = this.q.joins ?? [];
    this.q.joins.push({ table: this.db._tableName(table), on: _on });
    return this;
  }
  leftJoin(table: any, _on?: any) {
    return this.innerJoin(table, _on);
  }
  where(pred: any) {
    // Precedence: explicit setWhere (test-controlled) > Drizzle
    // expression parsing (auto). Tests that want a custom predicate
    // register one with setWhere and we honour that; otherwise we
    // try to extract a matcher from the Drizzle SQL chunks.
    if (this.q.table) {
      const matcher = this.db._resolveWhere(this.q.table);
      if (matcher) {
        (this.q as any).predicate = matcher;
        return this;
      }
    }
    if (pred) {
      const parsed = parsePredicate(this.db, this.q.table, pred);
      if (parsed) {
        (this.q as any).predicate = parsed;
        return this;
      }
    }
    return this;
  }
  groupBy(field: any) {
    this.q.groupByField = field?.name ?? field?._?.name ?? String(field);
    return this;
  }
  orderBy(field: any) {
    const name = field?.name ?? field?._?.name ?? String(field);
    const desc = String(field).includes("desc");
    this.q.orderBy = { field: name, desc };
    return this;
  }
  limit(n: number) {
    this.q.limitN = n;
    return this;
  }
  // Phase ADM-1: SQL OFFSET pagination. We apply it inside run() alongside
  // limit so list views with cursor-style pagination compose naturally.
  offset(n: number) {
    this.q.offsetN = n;
    return this;
  }
  // `.returning()` is a no-op on SELECT — Drizzle ignores it but the
  // route code chains it for symmetry. Return self so chains compose.
  returning(_fields?: any) {
    return this;
  }
  async all(): Promise<any[]> {
    return this.run();
  }
  // Promise interface — lets `await db.select(...)` work directly.
  then<TResult1 = any[], TResult2 = never>(
    resolve?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.run()).then(resolve as any, reject as any);
    } catch (err) {
      return Promise.reject(err).then(resolve as any, reject as any);
    }
  }
  private run(): any[] {
    if (!this.q.table) return [];
    const state = (this.db as any)._tables?.[this.q.table] ?? this.db.tables[this.q.table];
    if (!state) return [];
    let rows: any[] = state.rows.map((r) => ({ ...r }));
    // Stash the FROM row under `_<tableName>` so spec aliases that
    // reference the FROM table (e.g. `select({ meta: documentDicomMetadata })`)
    // can produce a nested object.
    if (rows.length) {
      rows = rows.map((r) => ({ ...r, [`_${this.q.table}`]: r }));
    }
    if (this.q.predicate) rows = rows.filter(this.q.predicate);
    if (this.q.orderBy) {
      const { field, desc } = this.q.orderBy;
      rows.sort((a, b) => {
        const av = a[field];
        const bv = b[field];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (desc ? -1 : 1);
      });
    }
    if (this.q.groupByField) {
      const seen = new Set<string>();
      rows = rows.filter((r) => {
        const k = r[this.q.groupByField!];
        if (k === undefined) return false;
        if (seen.has(String(k))) return false;
        seen.add(String(k));
        return true;
      });
    }
    if (this.q.limitN != null) rows = rows.slice(0, this.q.limitN);
    if (this.q.offsetN != null) rows = rows.slice(this.q.offsetN);
    // Materialise joined data into merged rows so applySelectSpec can
    // resolve column refs from joined tables. We attach each join's
    // matching rows under `_<joinedTable>` keys for downstream lookup.
    if (this.q.joins && this.q.joins.length) {
      rows = rows.map((r) => mergeJoinData(this.db, this.q.joins!, r));
    }
    return rows.map((r) => applySelectSpec(this.spec, r));
  }
}

// For each joined table, find the first matching row given the `on`
// condition and stash it under `_<tableName>` on the primary row.
// `on` is a Drizzle `eq(colA, colB)` between two columns — we
// resolve the eq and check both directions.
function mergeJoinData(
  db: MockD1,
  joins: Array<{ table: string; on?: any }>,
  primaryRow: any
): any {
  const out = { ...primaryRow };
  for (const j of joins) {
    const joinedRows = (db as any)._tables?.[j.table]?.rows ?? db.tables[j.table]?.rows ?? [];
    const eqInfo = parseEqCols(j.on);
    let matched: any = null;
    if (eqInfo) {
      // Match against `out` so earlier joins' merged columns
      // participate in subsequent join conditions (e.g. users joined
      // on patients.userId needs the patients merge to land first).
      matched = joinedRows.find((jr) => {
        if (eqInfo.leftTable === j.table) {
          return jr[eqInfo.leftKey] === out[eqInfo.rightKey];
        }
        if (eqInfo.rightTable === j.table) {
          return jr[eqInfo.rightKey] === out[eqInfo.leftKey];
        }
        return false;
      });
    }
    // Fallback: if no on condition or no match, leave undefined.
    if (matched) {
      out[`_${j.table}`] = matched;
      // Surface joined fields at top level for spec resolution, but
      // never overwrite a primary-table key — care-team's spec uses
      // `careTeamId: careTeamMembers.id` and a join might also carry
      // an `id` from patients or users, which would clobber.
      for (const [k, v] of Object.entries(matched)) {
        if (out[k] === undefined) out[k] = v;
      }
    }
  }
  return out;
}

// Lazily-built registry mapping column objects from @healthcare/db to
// (camelCase table name, camelCase row key). Drizzle 0.33+ exposes the
// table as a plain string on `col.table`, so the only way to find the
// camelCase row key is to scan the table exports and match by column
// identity. Built once on first request and cached by WeakMap on the
// db module object.
type ColumnRegistryEntry = { tableName: string; rowKey: string };
const _columnIdentityRegistry = new WeakMap<object, Map<object, ColumnRegistryEntry>>();

function getColumnRegistry(): Map<object, ColumnRegistryEntry> {
  // The first symbol-keyed object we encounter at runtime will be the
  // schema module. We cache per-module so tests can swap modules
  // without cross-test pollution.
  let dbModule: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    dbModule = require("@healthcare/db");
  } catch {
    return new Map();
  }
  const cached = _columnIdentityRegistry.get(dbModule);
  if (cached) return cached;
  const map = new Map<object, ColumnRegistryEntry>();
  for (const value of Object.values(dbModule)) {
    if (!value || typeof value !== "object") continue;
    const syms = Object.getOwnPropertySymbols(value);
    const nameSym = syms.find((s) => String(s).includes("drizzle:Name"));
    const colsSym = syms.find((s) => String(s).includes("drizzle:Columns"));
    if (!nameSym || !colsSym) continue;
    const tableName = toCamel(String(value[nameSym]));
    const colsMap = value[colsSym] as Record<string, any>;
    for (const [key, col] of Object.entries(colsMap)) {
      if (col && typeof col === "object") map.set(col, { tableName, rowKey: key });
    }
  }
  _columnIdentityRegistry.set(dbModule, map);
  return map;
}

function resolveColumnMeta(col: any): ColumnRegistryEntry | null {
  if (!col || typeof col !== "object") return null;
  const registry = getColumnRegistry();
  return registry.get(col) ?? null;
}

// Resolve a Drizzle column reference to its camelCase row key. Used by
// the where-clause parser; the table comes from the same registry.
function resolveColumnKeyFromColumn(col: any): string | null {
  return resolveColumnMeta(col)?.rowKey ?? null;
}

// Parse a Drizzle `eq(colA, colB)` expression where both sides are
// columns. Returns {leftTable, leftKey, rightTable, rightKey} or null.
function parseEqCols(eqExpr: any): {
  leftTable: string;
  leftKey: string;
  rightTable: string;
  rightKey: string;
} | null {
  const chunks = eqExpr?.queryChunks;
  if (!Array.isArray(chunks) || chunks.length < 5) return null;
  const colA = chunks[1];
  const colB = chunks[3];
  if (!colA || !colB) return null;
  const metaA = resolveColumnMeta(colA);
  const metaB = resolveColumnMeta(colB);
  if (!metaA || !metaB) return null;
  return {
    leftTable: metaA.tableName,
    leftKey: metaA.rowKey,
    rightTable: metaB.tableName,
    rightKey: metaB.rowKey,
  };
}

// Apply the Drizzle select projection spec to a row. The spec is
// `{alias: columnRef}` where columnRef has `.name` (snake_case). We
// map columnRef → camelCase row key (same resolveColumnKey lookup
// the predicate parser uses) and emit `{alias: row[key]}`.
//
// Also handles `{alias: tableRef}` where the alias should resolve to
// the joined sub-row stashed under `_<tableName>` by mergeJoinData.
// This is the shape Drizzle emits for `select({ file: files, ... })`.
function applySelectSpec(spec: any, row: any): any {
  if (!spec || typeof spec !== "object") return row;
  const out: any = {};
  for (const [alias, val] of Object.entries(spec)) {
    // Table ref: `select({ file: files })` produces a nested object
    // matching the joined row. Detect via presence of `drizzle:Name`
    // symbol (which is on tables). Column refs also carry the symbol
    // through their `.table` field but we look for the symbol on the
    // value itself first.
    if (val && typeof val === "object") {
      const ownSyms = Object.getOwnPropertySymbols(val);
      const nameSym = ownSyms.find((s) => String(s).includes("drizzle:Name"));
      const colsSym = ownSyms.find((s) => String(s).includes("drizzle:Columns"));
      if (nameSym && colsSym) {
        const tableName = toCamel(String(val[nameSym]));
        const nested = row[`_${tableName}`];
        if (nested) {
          out[alias] = { ...nested };
          continue;
        }
        // No joined sub-row: leave null so the test can detect it.
        out[alias] = null;
        continue;
      }
    }
    // Column ref: SQLiteText / SQLiteInteger etc. have `.name` and
    // `.table`. Resolve to the row's camelCase key.
    if (val && typeof val === "object" && val.name && val.table) {
      const meta = resolveColumnMeta(val);
      if (meta) {
        out[alias] = row[meta.rowKey];
        continue;
      }
      out[alias] = row[val.name];
    } else if (typeof val === "string") {
      // Aggregate / literal. Pass through raw if defined.
      out[alias] = val;
    } else {
      out[alias] = row[alias];
    }
  }
  return out;
}

class InsertBuilder {
  private rowsOut: Row[] = [];
  constructor(private db: MockD1, private table: any) {}
  values(row: Row | Row[]) {
    const arr = Array.isArray(row) ? row : [row];
    const tableName = this.db._tableName(this.table);
    if (!(this.db as any)._tables[tableName]) {
      (this.db as any)._tables[tableName] = { rows: [], insertSeq: 0, nextId: 1 };
    }
    const state = (this.db as any)._tables[tableName];
    for (const r of arr) {
      const withDefaults = { ...r };
      if (withDefaults.id == null) {
        withDefaults.id = `mock-${state.nextId++}`;
      }
      this.db._maybeThrowInsert(tableName, withDefaults);
      state.rows.push(withDefaults);
      state.insertSeq++;
      this.rowsOut.push({ ...withDefaults });
    }
    return this;
  }
  returning(_fields?: any) {
    return Promise.resolve(this.rowsOut.map((r) => ({ ...r })));
  }
  // SQLite-style UPSERT emulation. `target` is the column(s) we treat
  // as the conflict key; if a row with the same value already exists
  // we update it in place instead of appending. `set` is the patch
  // (raw values or SQL expressions — we evaluate the column references
  // by reading from the existing row).
  onConflictDoUpdate(opts: { target?: any; set?: Record<string, any> } = {}) {
    const tableName = this.db._tableName(this.table);
    const state = (this.db as any)._tables[tableName];
    if (!state) return this;
    const targetCol = (opts.target as any)?.[Symbol.for("drizzle:Name")]?.name
      ?? (opts.target as any)?.name
      ?? "scope";
    const set = opts.set ?? {};
    // Apply UPSERT semantics by mutating rowsOut in place: for each
    // row we just inserted, look for an existing row with the same
    // `targetCol` value and patch it; otherwise leave it as a fresh
    // insert (already pushed in `.values`).
    for (const r of this.rowsOut) {
      const key = r[targetCol];
      const existing = state.rows.find((x: Row) => x[targetCol] === key && x !== r);
      if (existing) {
        // Roll back the duplicate insert — pull it out of rowsOut and
        // state.rows (so we don't double-count), then patch existing.
        state.rows = state.rows.filter((x: Row) => x !== r);
        this.rowsOut = this.rowsOut.filter((x: Row) => x !== r);
        for (const [k, v] of Object.entries(set)) {
          // Evaluate SQL expression `{col} + 1` against existing row.
          // drizzle encodes a column reference inside `sql\`${col}\`` as
          // a chunk with `.name` (no `.value`). Walking all chunks and
          // stringifying in order reconstructs the expression.
          const chunks: any[] = (v as any)?.queryChunks ?? [];
          let expr = "";
          let colName: string | null = null;
          for (const c of chunks) {
            if (typeof c === "string") expr += c;
            else if (Array.isArray(c?.value)) expr += c.value.join("");
            else if (typeof c?.name === "string") {
              expr += c.name;
              colName = c.name;
            }
          }
          const m = expr.match(/^\s*(\w+)\s*\+\s*1\s*$/);
          if (m) {
            const col = m[1];
            existing[col] = (existing[col] ?? 0) + 1;
          } else if (colName && /\+\s*1/.test(expr)) {
            // Fallback: handle arbitrary column ref + `+ 1`.
            existing[colName] = (existing[colName] ?? 0) + 1;
          } else {
            existing[k] = v;
          }
        }
        this.rowsOut.push({ ...existing });
      }
    }
    return this;
  }
  // Some callers do `await db.insert(...).values(...)` without
  // `.returning()`. Make that work too.
  then<TResult1 = any[], TResult2 = never>(
    resolve?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.rowsOut.map((r) => ({ ...r }))).then(
      resolve as any,
      reject as any
    );
  }
}

class UpdateBuilder {
  private q: PendingQuery = {};
  private patch: Row = {};
  private updated: Row[] = [];
  constructor(private db: MockD1, private table: any) {
    this.q.table = this.db._tableName(table);
  }
  set(patch: Row) {
    this.patch = patch;
    return this;
  }
  where(pred: any) {
    // Precedence: explicit setWhere > Drizzle expression parsing.
    const matcher = this.db._resolveWhere(this.q.table!);
    if (matcher) {
      this.q.predicate = matcher;
      return this;
    }
    if (pred) {
      const parsed = parsePredicate(this.db, this.q.table, pred);
      if (parsed) {
        this.q.predicate = parsed;
        return this;
      }
    }
    return this;
  }
  private runUpdate(): Row[] {
    const state = this.db.tables[this.q.table!];
    if (!state) {
      this.updated = [];
      return this.updated;
    }
    this.updated = [];
    for (const row of state.rows) {
      if (!this.q.predicate || this.q.predicate(row)) {
        Object.assign(row, this.patch);
        this.updated.push({ ...row });
      }
    }
    return this.updated;
  }
  returning(_fields?: any) {
    return Promise.resolve(this.runUpdate());
  }
  then<TResult1 = any[], TResult2 = never>(
    resolve?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.runUpdate()).then(resolve as any, reject as any);
    } catch (err) {
      return Promise.reject(err).then(resolve as any, reject as any);
    }
  }
}

class DeleteBuilder {
  private q: PendingQuery = {};
  private removed: Row[] = [];
  constructor(private db: MockD1, private table: any) {
    this.q.table = this.db._tableName(table);
  }
  where(pred: any) {
    const matcher = this.db._resolveWhere(this.q.table!);
    if (matcher) {
      this.q.predicate = matcher;
      return this;
    }
    if (pred) {
      const parsed = parsePredicate(this.db, this.q.table, pred);
      if (parsed) {
        this.q.predicate = parsed;
        return this;
      }
    }
    return this;
  }
  private runDelete(): Row[] {
    const state = this.db.tables[this.q.table!];
    if (!state) {
      this.removed = [];
      return this.removed;
    }
    const kept: Row[] = [];
    this.removed = [];
    for (const row of state.rows) {
      if (!this.q.predicate || this.q.predicate(row)) {
        this.removed.push({ ...row });
      } else {
        kept.push(row);
      }
    }
    state.rows = kept;
    return this.removed;
  }
  returning(_fields?: any) {
    return Promise.resolve(this.runDelete());
  }
  then<TResult1 = any[], TResult2 = never>(
    resolve?: ((value: any[]) => TResult1 | PromiseLike<TResult1>) | null,
    reject?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    try {
      return Promise.resolve(this.runDelete()).then(resolve as any, reject as any);
    } catch (err) {
      return Promise.reject(err).then(resolve as any, reject as any);
    }
  }
}

export { MockD1 };
export type { Row };

// ─── Drizzle predicate parsing ─────────────────────────────
//
// Drizzle's `eq(col, val)`, `and(a, b)`, `or(a, b)`, `inArray(col, vals)`
// all return objects with `queryChunks`. We shallow-parse to build a
// row-level matcher so tests don't have to register a predicate for
// every query that runs inside the route (authMiddleware's user
// lookup, resolvePatient/resolveDoctor, etc.).
//
// Not exhaustive — covers the shapes used by the care-team route and
// access library. Add new shapes here as they appear in test failures.
function parsePredicate(
  db: MockD1,
  primaryTable: string | undefined,
  pred: any
): ((row: any) => boolean) | null {
  if (!pred) return null;
  // `and(...)` / `or(...)` and the eq/inArray SQL shapes all have a
  // `queryChunks` array on a SQL wrapper. Walk it.
  const chunks = pred?.queryChunks;
  if (!Array.isArray(chunks)) return null;

  // Collect (combinator, predicate) pairs by walking the chunks.
  let combinator: "AND" | "OR" = "AND";
  const parts: Array<{
    combinator: "AND" | "OR";
    pred: (row: any) => boolean;
  }> = [];

  for (const c of chunks) {
    const name = c?.constructor?.name;
    if (name === "SQL") {
      // Recurse into nested SQL chunk.
      const sub = parsePredicate(db, primaryTable, c);
      if (sub) parts.push({ combinator, pred: sub });
      combinator = "AND";
    } else if (name === "StringChunk") {
      const v = String(c?.value?.[0] ?? "");
      if (/\bor\b/i.test(v) && /(\(\s*$|^\s*\))/i.test(v) === false) {
        combinator = "OR";
      } else if (/\band\b/i.test(v)) {
        combinator = "AND";
      }
    }
  }

  // For `eq(col, val)` the chunks don't have any "and"/"or" markers,
  // so we still need to extract the column and value. Find the
  // SQLiteText (column) and Param (value) chunks in the original
  // chunks array.
  if (parts.length === 0) {
    let col: any = null;
    let val: any = undefined;
    for (const c of chunks) {
      const name = c?.constructor?.name;
      // Column ref: SQLiteText has `name` and `table` properties.
      if (name?.startsWith("SQLite")) {
        col = c;
      } else if (name === "Param") {
        val = c.value;
      } else if (name === "Array") {
        // Drizzle's `inArray(col, [...])` emits an Array chunk whose
        // elements are themselves Param wrappers around the actual
        // values. Unwrap one level so we get the bare value list.
        if (Array.isArray(c)) {
          val = c.map((entry: any) =>
            entry?.constructor?.name === "Param" ? entry.value : entry
          );
        } else {
          val = c[0];
        }
      }
    }
    if (col && val !== undefined) {
      if (columnBelongsToTable(db, col, primaryTable)) {
        const colKey = resolveColumnKey(db, col);
        if (!colKey) return null;
        if (Array.isArray(val)) {
          return (row: any) => val.includes(row[colKey]);
        }
        return (row: any) => row[colKey] === val;
      }
    }
    return null;
  }

  if (parts.length === 1) return parts[0].pred;
  // Combine sequentially.
  return (row: any) => {
    let acc = parts[0].pred(row);
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i].pred;
      if (parts[i].combinator === "OR") acc = acc || p(row);
      else acc = acc && p(row);
    }
    return acc;
  };
}

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
}

function columnBelongsToTable(
  db: MockD1,
  col: any,
  primaryTable: string | undefined
): boolean {
  if (!col || !primaryTable) return false;
  const colTable = col?.table;
  if (!colTable) return false;
  // Both sides are normalized to camelCase to match the mock's row
  // storage convention (see db._tableName).
  return db._tableName(colTable) === toCamel(primaryTable);
}

// Drizzle column `.name` is snake_case (e.g. "patient_id") but the
// rows in the mock are stored with the camelCase keys the table
// exposes via Symbol(drizzle:Columns). Walk the columns map to find
// the matching camelCase key.
function resolveColumnKey(db: MockD1, col: any): string | null {
  const colTable = col?.table;
  if (!colTable) return null;
  const colSym = Object.getOwnPropertySymbols(colTable).find((s) =>
    String(s).includes("drizzle:Columns")
  );
  if (!colSym) return null;
  const colsMap = colTable[colSym] as Record<string, any>;
  for (const [key, c] of Object.entries(colsMap)) {
    if (c === col) return key;
  }
  return null;
}