import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const DB =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/climazap_test";

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.spec.ts",
  globalSetup: "./tests/helpers/global-setup.ts", // recria o schema do banco de teste
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 5"], // mobile-first
    // Local: PW_CHROMIUM_PATH aponta para um Chromium já instalado. CI: `npx playwright install chromium`.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      DATABASE_URL: DB,
      DIRECT_URL: DB,
      AUTH_SECRET: "e2e-secret",
      AUTH_TRUST_HOST: "true",
      NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
    },
  },
});
