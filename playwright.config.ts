import "dotenv/config";
import { defineConfig } from "@playwright/test";

const PORT = 30099;

export default defineConfig({
  testDir: "./tests/e2e",
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  webServer: {
    // Dedicated port so this never collides with (or silently reuses) an
    // interactive `npm run dev` or the deploy container.
    command: `npm run dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
