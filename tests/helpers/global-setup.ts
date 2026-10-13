import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

// Recria o schema do banco de teste. Recusa rodar contra um banco que não tenha "test" no nome.
export default async function setup() {
  const url =
    process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/climazap_test";
  const dbName = new URL(url).pathname.slice(1);
  if (!dbName.includes("test")) {
    throw new Error(`Banco de teste precisa ter "test" no nome (recebido: ${dbName})`);
  }

  const client = new PrismaClient({ datasources: { db: { url } } });
  try {
    await client.$executeRawUnsafe("DROP SCHEMA IF EXISTS public CASCADE");
    await client.$executeRawUnsafe("CREATE SCHEMA public");
  } finally {
    await client.$disconnect();
  }

  execSync("npx prisma db push --skip-generate", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });
}
