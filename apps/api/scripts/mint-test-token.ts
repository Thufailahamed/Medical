#!/usr/bin/env bun
// Mint a test JWT for smoke-testing the API.
// Usage: bun run scripts/mint-test-token.ts <userId> [aud] [role]
//   aud defaults to "mobile", role is informational only.

import { generateToken } from "../src/lib/crypto";

const userId = process.argv[2];
const aud = (process.argv[3] as "mobile" | "admin") ?? "mobile";
const role = process.argv[4] ?? "patient";
if (!userId) {
  console.error("usage: bun run scripts/mint-test-token.ts <userId> [aud] [role]");
  process.exit(1);
}
const secret = process.env.JWT_SECRET ?? "super-secret-key-change-me-in-prod";
const token = await generateToken(userId, secret, { role }, { aud });
console.log(token);