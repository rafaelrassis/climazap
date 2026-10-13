import { defineConfig } from "vitest/config";
import path from "node:path";

const TEST_DB =
  process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/climazap_test";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/helpers/global-setup.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    fileParallelism: false, // testes de integração compartilham o mesmo banco
    env: {
      DATABASE_URL: TEST_DB,
      DIRECT_URL: TEST_DB,
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      AUTH_SECRET: "test-secret",
    },
  },
});
