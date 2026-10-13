import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login, prisma, seedTechnician } from "./helpers";

test.afterAll(async () => {
  await prisma.$disconnect();
});

// Falha em violações sérias/críticas de WCAG 2.0/2.1 A e AA
async function audit(page: Page, path: string) {
  await page.goto(path, { waitUntil: "networkidle" });
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(
    serious.map((v) => `${v.id} (${v.impact}) em ${path}: ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`),
  ).toEqual([]);
}

test("acessibilidade: telas públicas", async ({ page }) => {
  const t = await seedTechnician("a11y-pub", "SENT");
  for (const p of ["/login", "/cadastro", `/o/${t.publicId}`]) await audit(page, p);
});

test("acessibilidade: telas do técnico", async ({ page }) => {
  const t = await seedTechnician("a11y", "APPROVED", { reminderAt: new Date(Date.now() - 1000) });
  await login(page, t.email);
  for (const p of [
    "/inicio",
    "/orcamentos",
    "/orcamentos/novo",
    `/orcamentos/${t.quoteId}`,
    "/servicos",
    "/clientes",
    `/clientes/${t.customerId}`,
    "/ajustes",
  ])
    await audit(page, p);
});
