// @ts-nocheck
//
// Verifies the Zod → JSON Schema conversion used by the Gemini adapter
// produces responseSchema shapes that Gemini accepts: object, array,
// string/number/boolean/integer types, enums, nullable.

import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { zodToJsonSchema } from "../src/lib/ai/zod-to-json-schema";

describe("zodToJsonSchema", () => {
  it("converts the labReportExtractionSchema into a valid Gemini schema", async () => {
    const { labReportExtractionSchema } = await import("@healthcare/shared/extractors");
    const out = zodToJsonSchema(labReportExtractionSchema);
    expect(out.type).toBe("object");
    expect(out.properties).toHaveProperty("tests");
    expect(out.properties!.tests.type).toBe("array");
    expect(out.properties!.tests.items!.type).toBe("object");
    // `reportType` is optional/empty-string allowed; not in required.
    expect(out.required).toContain("tests");
  });

  it("marks nullable fields as ['string','null']", () => {
    const s = z.object({
      name: z.string(),
      middle: z.string().nullable().optional(),
    });
    const out = zodToJsonSchema(s);
    const middle = out.properties!.middle;
    expect(middle.type).toEqual(["string", "null"]);
    expect(out.required).toEqual(["name"]);
  });

  it("emits integer for z.number().int()", () => {
    const s = z.object({ count: z.number().int(), ratio: z.number() });
    const out = zodToJsonSchema(s);
    expect(out.properties!.count.type).toBe("integer");
    expect(out.properties!.ratio.type).toBe("number");
  });

  it("emits enum for z.enum()", () => {
    const s = z.object({ flag: z.enum(["normal", "low", "high", "critical"]) });
    const out = zodToJsonSchema(s);
    expect(out.properties!.flag.type).toBe("string");
    expect(out.properties!.flag.enum).toEqual(["normal", "low", "high", "critical"]);
  });
});