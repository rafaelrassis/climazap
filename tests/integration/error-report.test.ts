import { beforeEach, describe, expect, it, vi } from "vitest";
import { _resetErrorReport, reportError } from "@/lib/error-report";
import { resetDb } from "../helpers/db";

const sent: { to: string; subject: string; html: string; text: string }[] = [];
let failSend = false;
vi.mock("@/lib/email", async (orig) => ({
  ...(await orig<typeof import("@/lib/email")>()),
  sendEmail: async (m: { to: string; subject: string; html: string; text: string }) => {
    if (failSend) throw new Error("resend fora do ar");
    sent.push(m);
    return true;
  },
}));

beforeEach(async () => {
  await resetDb();
  sent.length = 0;
  failSend = false;
  _resetErrorReport();
  process.env.ERROR_ALERT_EMAIL = "dono@t.com";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

const ctx = { path: "/orcamentos/abc?token=segredo&nome=Maria", method: "GET", routeType: "render" };

describe("alerta de erros", () => {
  it("envia e-mail sem query string (sem dados pessoais) e com o topo da pilha", async () => {
    await reportError(new Error("Falha ao carregar <script>"), ctx);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("dono@t.com");
    expect(sent[0].subject).toBe("[FechouClima] Erro em GET /orcamentos/abc");
    expect(sent[0].text).not.toContain("segredo");
    expect(sent[0].text).not.toContain("Maria");
    expect(sent[0].html).toContain("&lt;script&gt;"); // escapado
    expect(sent[0].text).toContain("Error: Falha ao carregar");
  });

  it("o mesmo erro vira no máximo 1 e-mail por hora; erro diferente envia", async () => {
    await reportError(new Error("Mesmo erro"), ctx);
    await reportError(new Error("Mesmo erro"), ctx);
    await reportError(new Error("Mesmo erro"), { ...ctx, path: "/orcamentos/abc?x=1" });
    expect(sent).toHaveLength(1);
    await reportError(new Error("Outro erro"), ctx);
    expect(sent).toHaveLength(2);
  });

  it("dedupe vale entre instâncias (limite no banco)", async () => {
    await reportError(new Error("Erro global"), ctx);
    _resetErrorReport(); // simula outra instância sem memória
    await reportError(new Error("Erro global"), ctx);
    expect(sent).toHaveLength(1);
  });

  it("sem ERROR_ALERT_EMAIL só registra no log", async () => {
    delete process.env.ERROR_ALERT_EMAIL;
    await reportError(new Error("x"), ctx);
    expect(sent).toHaveLength(0);
    expect(console.error).toHaveBeenCalled();
  });

  it("nunca lança, mesmo se o e-mail falhar ou o erro não for um Error", async () => {
    failSend = true;
    await expect(reportError(new Error("boom"), ctx)).resolves.toBeUndefined();
    await expect(reportError("texto solto", ctx)).resolves.toBeUndefined();
    await expect(reportError(undefined, ctx)).resolves.toBeUndefined();
  });
});
