import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { compile } from "tailwindcss";

const require = createRequire(import.meta.url);
const tailwindDir = dirname(require.resolve("tailwindcss/package.json"));
const globalsPath = join(process.cwd(), "src", "app", "patient", "globals.css");

function loadStylesheet(id: string, base: string) {
  const file = id === "tailwindcss" ? join(tailwindDir, "index.css") : join(base, id);
  return Promise.resolve({
    path: file,
    base: dirname(file),
    content: readFileSync(file, "utf8"),
  });
}

async function compiledPatientCss() {
  const raw = readFileSync(globalsPath, "utf8");
  const css = raw
    .replace(/@import url\("https:[^"]+"\);\s*/g, "")
    .replace('@import "tailwindcss";', '@import "tailwindcss" source(none);');
  const compiler = await compile(css, { base: tailwindDir, loadStylesheet });
  return compiler.build([
    "bg-brand",
    "bg-brand-soft",
    "text-text",
    "text-text-soft",
    "bg-surface-2",
    "border-border",
    "bg-success-soft",
    "text-success",
    "bg-warn-soft",
    "bg-danger-soft",
    "rounded-pill",
    "rounded-inner",
    "rounded-card",
    "shadow-card",
    "shadow-float",
    "shadow-brand",
  ]);
}

describe("patient design tokens", () => {
  it("registers the portal tokens as Tailwind theme values", async () => {
    const css = await compiledPatientCss();
    for (const utility of [
      ".bg-brand",
      ".bg-brand-soft",
      ".text-text",
      ".text-text-soft",
      ".bg-surface-2",
      ".border-border",
      ".bg-success-soft",
      ".text-success",
      ".bg-warn-soft",
      ".bg-danger-soft",
      ".rounded-pill",
      ".rounded-inner",
      ".rounded-card",
      ".shadow-card",
      ".shadow-float",
      ".shadow-brand",
    ]) {
      expect(css).toContain(utility);
    }
  });
});
