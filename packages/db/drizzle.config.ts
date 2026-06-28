import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "sqlite",
  driver: "d1",
  dbCredentials: {
    databaseId: "1e38b1d5-9e17-4744-b909-b61c1b631691",
  },
});
