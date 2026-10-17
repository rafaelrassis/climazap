import type { NudgeKind, QuoteStatus } from "@prisma/client";

// Fuso fixo: America/Sao_Paulo é UTC-3 o ano inteiro (sem horário de verão desde 2019).
const BR_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_SAMPLE = 10;

function brParts(d: Date) {
  const br = new Date(d.getTime() - BR_OFFSET_MS);
  return { y: br.getUTCFullYear(), m: br.getUTCMonth(), day: br.getUTCDate(), weekday: br.getUTCDay() };
}

// Segunda-feira 00:00 BRT da semana que contém `d`
function weekStartBR(d: Date): Date {
  const { y, m, day, weekday } = brParts(d);
  const sinceMonday = (weekday + 6) % 7; // 0 = segunda
  return new Date(Date.UTC(y, m, day - sinceMonday) + BR_OFFSET_MS);
}

// Chave "AAAA-MM-DD" da segunda-feira BRT da semana de `d`
function weekKey(d: Date): string {
  const { y, m, day } = brParts(weekStartBR(d));
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10;
}

export type CohortUserRow = { id: string; createdAt: Date };
export type CohortQuoteRow = { userId: string; sentAt: Date | null };

export type WeeklyCohort = {
  semana: string;
  cadastrados: number;
  ativacaoPct: number;
  retencaoPct: number;
};

// Agrupa técnicos pela semana de cadastro (segunda-feira BRT). Ativação: >=1 orçamento enviado
// nos 7 dias seguintes ao cadastro. Retenção: >=2 orçamentos enviados entre os dias 7 e 14.
export function weeklyCohorts(users: CohortUserRow[], quotes: CohortQuoteRow[]): WeeklyCohort[] {
  const sentByUser = new Map<string, Date[]>();
  for (const q of quotes) {
    if (!q.sentAt) continue;
    const list = sentByUser.get(q.userId);
    if (list) list.push(q.sentAt);
    else sentByUser.set(q.userId, [q.sentAt]);
  }

  const cohorts = new Map<string, CohortUserRow[]>();
  for (const u of users) {
    const key = weekKey(u.createdAt);
    const list = cohorts.get(key);
    if (list) list.push(u);
    else cohorts.set(key, [u]);
  }

  const result: WeeklyCohort[] = [];
  for (const [semana, cohortUsers] of cohorts) {
    let ativados = 0;
    let retidos = 0;
    for (const u of cohortUsers) {
      const sentDates = sentByUser.get(u.id) ?? [];
      const t0 = u.createdAt.getTime();
      const ativacaoCount = sentDates.filter((d) => d.getTime() >= t0 && d.getTime() < t0 + 7 * DAY_MS).length;
      const retencaoCount = sentDates.filter((d) => d.getTime() >= t0 + 7 * DAY_MS && d.getTime() < t0 + 14 * DAY_MS).length;
      if (ativacaoCount >= 1) ativados++;
      if (retencaoCount >= 2) retidos++;
    }
    result.push({
      semana,
      cadastrados: cohortUsers.length,
      ativacaoPct: pct(ativados, cohortUsers.length),
      retencaoPct: pct(retidos, cohortUsers.length),
    });
  }
  return result.sort((a, b) => a.semana.localeCompare(b.semana));
}

export type FunnelQuoteRow = {
  sentAt: Date | null;
  viewedAt: Date | null;
  status: QuoteStatus;
  respondedAt: Date | null;
};

export type FunnelWeek = {
  semana: string;
  enviados: number;
  vistos: number;
  vistosPct: number;
  aprovados: number;
  aprovadosPct: number;
  medianaHorasResposta: number | null;
};

// Funil enviado -> visto -> aprovado por semana de envio, e mediana de horas até respondedAt.
export function funnel(quotes: FunnelQuoteRow[]): FunnelWeek[] {
  const byWeek = new Map<string, FunnelQuoteRow[]>();
  for (const q of quotes) {
    if (!q.sentAt) continue;
    const key = weekKey(q.sentAt);
    const list = byWeek.get(key);
    if (list) list.push(q);
    else byWeek.set(key, [q]);
  }

  const result: FunnelWeek[] = [];
  for (const [semana, rows] of byWeek) {
    const vistos = rows.filter((q) => q.viewedAt !== null).length;
    const aprovados = rows.filter((q) => q.status === "APPROVED").length;
    const horas = rows
      .filter((q): q is FunnelQuoteRow & { sentAt: Date; respondedAt: Date } => q.sentAt !== null && q.respondedAt !== null)
      .map((q) => (q.respondedAt.getTime() - q.sentAt.getTime()) / (60 * 60 * 1000));
    result.push({
      semana,
      enviados: rows.length,
      vistos,
      vistosPct: pct(vistos, rows.length),
      aprovados,
      aprovadosPct: pct(aprovados, rows.length),
      medianaHorasResposta: median(horas),
    });
  }
  return result.sort((a, b) => a.semana.localeCompare(b.semana));
}

export type NudgeEffectQuoteRow = {
  id: string;
  sentAt: Date | null;
  respondedAt: Date | null;
  status: QuoteStatus;
};
export type NudgeEffectNudgeRow = { quoteId: string; kind: NudgeKind };

export type NudgeEffectGroup = { n: number; aprovadoPct: number | null };
export type NudgeEffect = { cobrado: NudgeEffectGroup; naoCobrado: NudgeEffectGroup };

// Dos orçamentos enviados sem resposta há 2+ dias (em algum momento da vida deles), compara a
// taxa de aprovação de quem foi cobrado (>=1 QuoteNudge "NUDGE") com quem não foi. aprovadoPct
// fica null ("amostra pequena") com menos de 10 orçamentos no grupo.
export function nudgeEffect(quotes: NudgeEffectQuoteRow[], nudges: NudgeEffectNudgeRow[], now: Date): NudgeEffect {
  const nudgedQuoteIds = new Set(nudges.filter((n) => n.kind === "NUDGE").map((n) => n.quoteId));

  const stale = quotes.filter((q) => {
    if (!q.sentAt) return false;
    const end = q.respondedAt ?? now;
    return end.getTime() - q.sentAt.getTime() >= 2 * DAY_MS;
  });

  const group = (rows: NudgeEffectQuoteRow[]): NudgeEffectGroup => {
    const n = rows.length;
    if (n < MIN_SAMPLE) return { n, aprovadoPct: null };
    const aprovados = rows.filter((q) => q.status === "APPROVED").length;
    return { n, aprovadoPct: pct(aprovados, n) };
  };

  return {
    cobrado: group(stale.filter((q) => nudgedQuoteIds.has(q.id))),
    naoCobrado: group(stale.filter((q) => !nudgedQuoteIds.has(q.id))),
  };
}

export type ReferralUserRow = { id: string; createdAt: Date; referredById: string | null };
export type ReferralsByReferrer = { referrerId: string; indicados: number };
export type Referrals = { porTecnico: ReferralsByReferrer[]; totalIndicados: number; ativacaoPct: number };

// Indicados por técnico (só contagens, sem nome/e-mail) e % dos indicados que ativaram
// (>=1 orçamento enviado nos 7 dias seguintes ao próprio cadastro).
export function referrals(users: ReferralUserRow[], quotes: CohortQuoteRow[]): Referrals {
  const sentByUser = new Map<string, Date[]>();
  for (const q of quotes) {
    if (!q.sentAt) continue;
    const list = sentByUser.get(q.userId);
    if (list) list.push(q.sentAt);
    else sentByUser.set(q.userId, [q.sentAt]);
  }

  const referred = users.filter((u): u is ReferralUserRow & { referredById: string } => u.referredById !== null);

  const byReferrer = new Map<string, number>();
  for (const u of referred) byReferrer.set(u.referredById, (byReferrer.get(u.referredById) ?? 0) + 1);
  const porTecnico = Array.from(byReferrer, ([referrerId, indicados]) => ({ referrerId, indicados })).sort(
    (a, b) => b.indicados - a.indicados,
  );

  const ativados = referred.filter((u) => {
    const t0 = u.createdAt.getTime();
    return (sentByUser.get(u.id) ?? []).some((d) => d.getTime() >= t0 && d.getTime() < t0 + 7 * DAY_MS);
  }).length;

  return { porTecnico, totalIndicados: referred.length, ativacaoPct: pct(ativados, referred.length) };
}
