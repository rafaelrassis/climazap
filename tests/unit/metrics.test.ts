import { describe, expect, it } from "vitest";
import { funnel, nudgeEffect, weeklyCohorts } from "@/lib/metrics";

const DAY = 86_400_000;
const HOUR = 3_600_000;

describe("weeklyCohorts", () => {
  it("agrupa pela segunda-feira BRT, mesmo em domingo 23h BRT (02h UTC de segunda)", () => {
    // domingo 11/10/2026 23:00 BRT = segunda 12/10 02:00 UTC: ainda pertence à semana de 05/10 a 11/10
    const sundayLateBRT = new Date("2026-10-12T02:00:00Z");
    const mondayBRT = new Date("2026-10-05T03:00:00Z"); // segunda 05/10 00:00 BRT
    const users = [
      { id: "a", createdAt: mondayBRT },
      { id: "b", createdAt: sundayLateBRT },
    ];
    const result = weeklyCohorts(users, []);
    expect(result).toHaveLength(1);
    expect(result[0].semana).toBe("2026-10-05");
    expect(result[0].cadastrados).toBe(2);
  });

  it("separa semanas vizinhas corretamente", () => {
    const week1 = new Date("2026-10-05T03:00:00Z"); // segunda 05/10 00:00 BRT
    const week2 = new Date("2026-10-12T03:00:00Z"); // segunda 12/10 00:00 BRT
    const users = [
      { id: "a", createdAt: week1 },
      { id: "b", createdAt: week2 },
    ];
    const result = weeklyCohorts(users, []);
    expect(result.map((r) => r.semana)).toEqual(["2026-10-05", "2026-10-12"]);
  });

  it("ativação: >=1 enviado nos 7 dias seguintes ao cadastro; retenção: >=2 entre os dias 7 e 14", () => {
    const createdAt = new Date("2026-10-05T03:00:00Z"); // segunda 00:00 BRT
    const users = [
      { id: "ativo", createdAt },
      { id: "retido", createdAt },
      { id: "so-ativo", createdAt },
      { id: "nada", createdAt },
    ];
    const quotes = [
      // ativo: 1 enviado no dia 2, nada depois
      { userId: "ativo", sentAt: new Date(createdAt.getTime() + 2 * DAY) },
      // retido: ativo no dia 1 e com 2 envios nos dias 8 e 10 (retenção)
      { userId: "retido", sentAt: new Date(createdAt.getTime() + 1 * DAY) },
      { userId: "retido", sentAt: new Date(createdAt.getTime() + 8 * DAY) },
      { userId: "retido", sentAt: new Date(createdAt.getTime() + 10 * DAY) },
      // so-ativo: ativo, mas só 1 envio entre os dias 7-14 (não conta retenção)
      { userId: "so-ativo", sentAt: new Date(createdAt.getTime() + 3 * DAY) },
      { userId: "so-ativo", sentAt: new Date(createdAt.getTime() + 9 * DAY) },
      // fora da janela de ativação (dia 7 exato já não conta: só "nos 7 dias seguintes")
      { userId: "nada", sentAt: new Date(createdAt.getTime() + 7 * DAY) },
    ];
    const [cohort] = weeklyCohorts(users, quotes);
    expect(cohort.cadastrados).toBe(4);
    expect(cohort.ativacaoPct).toBeCloseTo(75, 1); // ativo, retido, so-ativo
    expect(cohort.retencaoPct).toBeCloseTo(25, 1); // só retido
  });
});

describe("funnel", () => {
  it("agrupa por semana de envio e calcula vistos/aprovados em número e %", () => {
    const sentAt = new Date("2026-10-05T15:00:00Z");
    const quotes = [
      { sentAt, viewedAt: new Date(sentAt.getTime() + HOUR), status: "APPROVED" as const, respondedAt: new Date(sentAt.getTime() + 2 * HOUR) },
      { sentAt, viewedAt: new Date(sentAt.getTime() + HOUR), status: "REJECTED" as const, respondedAt: new Date(sentAt.getTime() + 4 * HOUR) },
      { sentAt, viewedAt: null, status: "SENT" as const, respondedAt: null },
      { sentAt, viewedAt: null, status: "EXPIRED" as const, respondedAt: null },
    ];
    const [week] = funnel(quotes);
    expect(week.enviados).toBe(4);
    expect(week.vistos).toBe(2);
    expect(week.vistosPct).toBeCloseTo(50, 1);
    expect(week.aprovados).toBe(1);
    expect(week.aprovadosPct).toBeCloseTo(25, 1);
    expect(week.medianaHorasResposta).toBeCloseTo(3, 1); // mediana de 2h e 4h
  });

  it("ignora orçamentos nunca enviados (sentAt null)", () => {
    const quotes = [{ sentAt: null, viewedAt: null, status: "DRAFT" as const, respondedAt: null }];
    expect(funnel(quotes)).toEqual([]);
  });

  it("mediana null sem nenhuma resposta", () => {
    const sentAt = new Date("2026-10-05T15:00:00Z");
    const quotes = [{ sentAt, viewedAt: null, status: "SENT" as const, respondedAt: null }];
    const [week] = funnel(quotes);
    expect(week.medianaHorasResposta).toBeNull();
  });
});

describe("nudgeEffect", () => {
  const now = new Date("2026-10-20T12:00:00Z");

  function makeStaleQuotes(count: number, approvedCount: number, idPrefix: string) {
    return Array.from({ length: count }, (_, i) => ({
      id: `${idPrefix}${i}`,
      sentAt: new Date(now.getTime() - 5 * DAY), // sem resposta há 5 dias: stale
      respondedAt: null,
      status: i < approvedCount ? ("APPROVED" as const) : ("SENT" as const),
    }));
  }

  it("compara aprovação de quem foi cobrado vs não, só considerando stale (2+ dias sem resposta)", () => {
    const cobrados = makeStaleQuotes(12, 6, "c"); // 50% aprovado
    const naoCobrados = makeStaleQuotes(10, 2, "n"); // 20% aprovado
    const recente = [{ id: "fresh", sentAt: new Date(now.getTime() - 1 * DAY), respondedAt: null, status: "SENT" as const }]; // não é stale
    const nudges = cobrados.map((q) => ({ quoteId: q.id, kind: "NUDGE" as const }));

    const result = nudgeEffect([...cobrados, ...naoCobrados, ...recente], nudges, now);
    expect(result.cobrado).toEqual({ n: 12, aprovadoPct: 50 });
    expect(result.naoCobrado).toEqual({ n: 10, aprovadoPct: 20 });
  });

  it("amostra pequena (<10) retorna aprovadoPct null", () => {
    const cobrados = makeStaleQuotes(9, 9, "c");
    const nudges = cobrados.map((q) => ({ quoteId: q.id, kind: "NUDGE" as const }));
    const result = nudgeEffect(cobrados, nudges, now);
    expect(result.cobrado).toEqual({ n: 9, aprovadoPct: null });
    expect(result.naoCobrado).toEqual({ n: 0, aprovadoPct: null });
  });

  it("SNOOZE não conta como cobrança", () => {
    const quotes = makeStaleQuotes(10, 5, "s");
    const nudges = quotes.map((q) => ({ quoteId: q.id, kind: "SNOOZE" as const }));
    const result = nudgeEffect(quotes, nudges, now);
    expect(result.cobrado).toEqual({ n: 0, aprovadoPct: null });
    expect(result.naoCobrado).toEqual({ n: 10, aprovadoPct: 50 });
  });

  it("usa respondedAt (não `now`) para quem já respondeu: resposta rápida não entra como stale", () => {
    const sentAt = new Date(now.getTime() - 10 * DAY);
    const rapido = Array.from({ length: 10 }, (_, i) => ({
      id: `r${i}`,
      sentAt,
      respondedAt: new Date(sentAt.getTime() + HOUR), // respondeu em 1h: nunca foi stale
      status: "APPROVED" as const,
    }));
    const demorado = Array.from({ length: 10 }, (_, i) => ({
      id: `d${i}`,
      sentAt,
      respondedAt: new Date(sentAt.getTime() + 3 * DAY), // demorou 3 dias: foi stale
      status: "APPROVED" as const,
    }));
    const result = nudgeEffect([...rapido, ...demorado], [], now);
    expect(result.naoCobrado).toEqual({ n: 10, aprovadoPct: 100 }); // só os "demorado" contam
  });
});
