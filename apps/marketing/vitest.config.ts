import { defineConfig } from "vitest/config";
import path from "node:path";

// Vitest config for the marketing app's portal subtree.
//
// Scope: portal-only. Tests live next to source files
// (`*.test.tsx` / `*.test.ts`). We exclude the marketing landing
// site (src/app/page.tsx, src/app/login/page.tsx) because those
// surface a different audience. Coverage is left optional — wire
// `--coverage` in CI when ready.
//
// `environment: "happy-dom"` because jsdom is famously slow under
// Vitest 4; happy-dom is the modern alternative and React 19 plays
// nicely with it.
export default defineConfig({
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "src/**/*.test.{ts,tsx}",
      "src/portal/**/*.test.{ts,tsx}",
    ],
    exclude: ["node_modules", ".next", "dist"],
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/portal": path.resolve(__dirname, "./src/portal"),
    },
  },
});
