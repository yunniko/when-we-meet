import "dotenv/config";
import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests: server modules against the local dev Postgres
// (`docker compose up -d db`). Kept apart from the unit config so
// `npm run test:unit` never needs a database.
export default defineConfig({
  test: {
    include: ["tests/integration/**/*.spec.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // `server-only` throws outside Next's server bundle; these tests are
      // server-side by definition.
      "server-only": path.resolve(__dirname, "tests/integration/server-only-stub.ts"),
    },
  },
});
