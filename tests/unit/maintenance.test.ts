import { describe, expect, it } from "vitest";
import { addMonths, DEFAULT_MAINTENANCE_TEMPLATE, renderMaintenanceMessage, resolveReminder } from "@/lib/maintenance";
import { reminderTextSchema } from "@/lib/validations/service";

describe("addMonths", () => {
  it("31/ago + 6 meses -> 28/fev (nunca 3/mar)", () => {
    const d = addMonths(new Date(2026, 7, 31), 6); // 31/ago/2026
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(1); // fevereiro
    expect(d.getDate()).toBe(28);
  });

  it("29/fev em ano bissexto", () => {
    const d = addMonths(new Date(2023, 7, 31), 6); // 31/ago/2023 -> fev/2024 (bissexto)
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(29);
  });

  it("virada de ano", () => {
    const d = addMonths(new Date(2026, 10, 15), 3); // 15/nov/2026 + 3
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(1); // fevereiro
    expect(d.getDate()).toBe(15);
  });

  it("dia que existe no mês de destino não é alterado", () => {
    const d = addMonths(new Date(2026, 0, 15), 1); // 15/jan + 1 = 15/fev
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(15);
  });

  it("preserva o horário", () => {
    const d = addMonths(new Date(2026, 0, 15, 14, 30, 0), 1);
    expect(d.getHours()).toBe(14);
    expect(d.getMinutes()).toBe(30);
  });
});

describe("resolveReminder", () => {
  const svc = (name: string, reminderMonths: number | null, reminderText: string | null = null) => ({
    service: { name, reminderMonths, reminderText },
  });

  it("vale o serviço de menor prazo entre os itens", () => {
    const items = [svc("Instalação", 12), svc("Limpeza", 6, "limpar!"), svc("Carga de gás", 12)];
    expect(resolveReminder(items, 6)).toEqual({ months: 6, text: "limpar!", service: "Limpeza" });
  });

  it("item sem serviço (avulso) é ignorado", () => {
    const items = [{ service: null }, svc("Limpeza", 6, "limpar!")];
    expect(resolveReminder(items, null)).toEqual({ months: 6, text: "limpar!", service: "Limpeza" });
  });

  it("nenhum item com lembrete usa o padrão do técnico, sem nome de serviço", () => {
    const items = [svc("Visita técnica", null), { service: null }];
    expect(resolveReminder(items, 6)).toEqual({ months: 6, text: null, service: null });
  });

  it("sem item com lembrete e padrão nulo: sem lembrete", () => {
    expect(resolveReminder([svc("Visita técnica", null)], null)).toBeNull();
    expect(resolveReminder([], null)).toBeNull();
  });

  it("empate: o primeiro item da lista vence", () => {
    const items = [svc("A", 6, "do A"), svc("B", 6, "do B")];
    expect(resolveReminder(items, null)).toEqual({ months: 6, text: "do A", service: "A" });
  });
});

describe("renderMaintenanceMessage", () => {
  it("usa o padrão quando text é null", () => {
    const msg = renderMaintenanceMessage({ cliente: "Maria", tecnico: "Zé Frio", servico: "limpeza" }, null);
    expect(msg).toBe(DEFAULT_MAINTENANCE_TEMPLATE.replace("{cliente}", "Maria").replace("{tecnico}", "Zé Frio").replace("{servico}", "limpeza"));
  });

  it("usa o texto próprio do serviço quando informado", () => {
    const msg = renderMaintenanceMessage(
      { cliente: "Maria", tecnico: "Zé Frio", servico: "limpeza" },
      "Oi {cliente}, hora de limpar! ({servico}) - {tecnico}",
    );
    expect(msg).toBe("Oi Maria, hora de limpar! (limpeza) - Zé Frio");
  });
});

describe("reminderTextSchema", () => {
  it("aceita null, texto normal e os placeholders válidos", () => {
    expect(reminderTextSchema.safeParse(null).success).toBe(true);
    expect(reminderTextSchema.safeParse("Hora de limpar, {cliente}! - {tecnico} ({servico})").success).toBe(true);
  });

  it("rejeita placeholder desconhecido", () => {
    const res = reminderTextSchema.safeParse("Oi {cliente}, seu {valor} está pronto");
    expect(res.success).toBe(false);
  });

  it("rejeita acima de 300 caracteres", () => {
    expect(reminderTextSchema.safeParse("a".repeat(300)).success).toBe(true);
    expect(reminderTextSchema.safeParse("a".repeat(301)).success).toBe(false);
  });
});
