// @ts-nocheck
//
// Convert a Zod schema (used by the extractor prompts) into a
// Gemini-compatible JSON Schema for `responseSchema`.
//
// Gemini's `responseSchema` requires OpenAPI 3.0-style JSON Schema:
//   - `type` must be one of: object, array, string, number, boolean, integer
//   - `properties` is required when type=object
//   - `required` lists keys whose values are NOT .optional()/.nullable()
//   - nested object schemas get `properties` + `required`
//   - enums become `type: string, enum: [...]`
//   - nullable fields become `type: [..., "null"]`
//
// We only handle the shapes our extractors emit. Anything more exotic
// falls back to `type: string` so the model still returns something
// parseable, and the Zod re-validation in the runner catches drift.

import type { ZodTypeAny } from "zod";

interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  description?: string;
  nullable?: boolean;
}

function unwrap(z: ZodTypeAny): { inner: ZodTypeAny; isOptional: boolean; isNullable: boolean } {
  let inner: ZodTypeAny = z;
  let isOptional = false;
  let isNullable = false;

  // Drill through wrappers.
  // ZodOptional / ZodNullable are wrappers around another schema.
  while (true) {
    const def: any = (inner as any)._def ?? (inner as any).def;
    if (!def) break;
    const typeName: string = def.typeName ?? def.type ?? "";
    if (typeName === "ZodOptional") {
      isOptional = true;
      inner = def.innerType;
      continue;
    }
    if (typeName === "ZodNullable") {
      isNullable = true;
      inner = def.innerType;
      continue;
    }
    if (typeName === "ZodDefault") {
      // Treat defaults as optional for schema purposes.
      isOptional = true;
      inner = def.innerType;
      continue;
    }
    break;
  }
  return { inner, isOptional, isNullable };
}

export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  const { inner, isOptional, isNullable } = unwrap(schema);
  const def: any = (inner as any)._def ?? (inner as any).def;
  const typeName: string = def.typeName ?? def.type ?? "";

  const out: JsonSchema = {};

  if (typeName === "ZodObject") {
    const shape: Record<string, ZodTypeAny> = def.shape();
    const props: Record<string, JsonSchema> = {};
    const required: string[] = [];
    for (const [key, child] of Object.entries(shape)) {
      const childSchema = zodToJsonSchema(child);
      props[key] = childSchema;
      const w = unwrap(child);
      if (!w.isOptional && !w.isNullable) required.push(key);
    }
    out.type = "object";
    out.properties = props;
    if (required.length) out.required = required;
  } else if (typeName === "ZodArray") {
    out.type = "array";
    out.items = zodToJsonSchema(def.type);
  } else if (typeName === "ZodString") {
    out.type = "string";
    if (Array.isArray(def.values) && def.values.length) {
      out.enum = def.values;
    }
  } else if (typeName === "ZodNumber") {
    // Check for integer (ZodInt uses ZodNumber with check: integer()).
    const checks: any[] = def.checks ?? [];
    const isInt = checks.some((c) => c.kind === "int");
    out.type = isInt ? "integer" : "number";
  } else if (typeName === "ZodBoolean") {
    out.type = "boolean";
  } else if (typeName === "ZodEnum") {
    out.type = "string";
    if (Array.isArray(def.values)) out.enum = def.values;
  } else if (typeName === "ZodUnion") {
    const opts: ZodTypeAny[] = def.options ?? [];
    const members = opts.map((o) => zodToJsonSchema(o));
    const types = new Set<string>();
    for (const m of members) {
      if (m.type) {
        for (const t of Array.isArray(m.type) ? m.type : [m.type]) types.add(t);
      }
    }
    if (types.size) out.type = Array.from(types);
  } else if (typeName === "ZodLiteral") {
    const v = def.value;
    if (typeof v === "number") out.type = "number";
    else if (typeof v === "boolean") out.type = "boolean";
    else {
      out.type = "string";
      out.enum = [String(v)];
    }
  } else {
    // Fallback: emit as a free-form string. The model's prompt + Zod
    // re-validation will catch drift.
    out.type = "string";
  }

  if (isNullable) {
    out.type = Array.isArray(out.type)
      ? [...out.type, "null"]
      : [out.type || "string", "null"];
    out.nullable = true;
  }
  if (isOptional && !isNullable) {
    // Optional but non-nullable: omit from `required` upstream. The
    // schema object itself doesn't need a marker.
  }
  return out;
}
