// vitest config — apps/api
//
// Day-1 strategy: pure unit tests + route smoke tests using a tiny
// fluent mock DB (see tests/_mockDb.ts). No workerd, no Miniflare,
// no D1 binding — keeps the suite under 5s and CI-runnable on any
// machine with bun installed.
//
// When ready for real D1 (week 2+), swap to
// @cloudflare/vitest-pool-workers behind the same `bun test`
// command. Test files stay unchanged.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    pool: "forks",
    testTimeout: 10_000,
  },
  resolve: {
    alias: [
      { find: /^@healthcare\/shared\/(.+)$/, replacement: new URL("../../packages/shared/src/$1", import.meta.url).pathname },
      { find: /^@healthcare\/shared$/, replacement: new URL("../../packages/shared/src/index.ts", import.meta.url).pathname },
      { find: /^@healthcare\/db\/(.+)$/, replacement: new URL("../../packages/db/src/$1", import.meta.url).pathname },
      { find: /^@healthcare\/db$/, replacement: new URL("../../packages/db/src/index.ts", import.meta.url).pathname },
    ],
  },
});