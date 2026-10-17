import type { QuoteStatus } from "@prisma/client";
import { formatBRL } from "@/lib/money";
import { renderWaTemplate } from "@/lib/wa-template";

const DAY_MS = 24 * 60 * 60 * 1000;

export const NUDGE_PLACEHOLDERS = ["{cliente}", "{numero}", "{valor}", "{link}", "{tecnico}"] as const;
export const DEFAULT_NUDGE_TEMPLATE =
  "Oi, {cliente}! Conseguiu ver o orçamento #{numero}? Qualquer dúvida é só falar.\n{link}";
// Usada quando o orçamento nunca foi aberto, só quando o técnico não tem modelo próprio
export const NOT_VIEWED_NUDGE_TEMPLATE =
  "Oi, {cliente}! Mandei o orçamento #{numero} por aqui. Conseguiu abrir o link?\n{link}";
// Usada quando o orçamento vence em até 24h, mesmo que o técnico tenha um modelo próprio
export const URGENT_NUDGE_TEMPLATE =
  "Oi, {cliente}! O orçamento #{numero} vence em breve. Consegue me confirmar para eu garantir o valor e reservar sua data?\n{link}";

// Selo curto para SENT: "visto" ou "não abriu o link". null fora de SENT (não se aplica).
export function viewedLabel(viewedAt: Date | null, status: QuoteStatus): string | null {
  if (status !== "SENT") return null;
  return viewedAt ? "visto" : "não abriu o link";
}

// Quantos dias faltam para vencer (arredondado para cima): 0 = vencido, 1 = vence em até 24h
export function daysUntilExpiry(validUntil: Date | null, now: Date): number | null {
  if (!validUntil) return null;
  const diff = validUntil.getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
}

export function expiryLabel(validUntil: Date | null, now: Date): string | null {
  const d = daysUntilExpiry(validUntil, now);
  if (d === null || d > 1) return null;
  return d === 0 ? "vence hoje" : "vence em até 24h";
}

// Adiar esconde o orçamento até hoje + 3 dias: só vale se ele ainda estiver válido depois disso
export const SNOOZE_GUARD_MS = 3 * DAY_MS;
export function canSnooze(validUntil: Date | null, now: Date): boolean {
  return !validUntil || validUntil.getTime() > now.getTime() + SNOOZE_GUARD_MS;
}

export type FollowUpContext = { template: string | null; tecnico: string; baseUrl: string };

export function followUpMessage(
  q: { customerName: string; number: number; totalCents: number; publicId: string; validUntil: Date | null; viewedAt: Date | null },
  now: Date,
  ctx: FollowUpContext,
): string {
  const d = daysUntilExpiry(q.validUntil, now);
  const template =
    d !== null && d <= 1
      ? URGENT_NUDGE_TEMPLATE
      : (ctx.template ?? (q.viewedAt ? DEFAULT_NUDGE_TEMPLATE : NOT_VIEWED_NUDGE_TEMPLATE));
  return renderWaTemplate(template, {
    cliente: q.customerName,
    valor: formatBRL(q.totalCents),
    link: `${ctx.baseUrl.replace(/\/$/, "")}/o/${q.publicId}`,
    numero: q.number,
    tecnico: ctx.tecnico,
  });
}

const fmtShort = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });

// lastNudgeAt no futuro = cobrança adiada (volta às listas 48h depois dessa data)
export function nudgedLabel(lastNudgeAt: Date | null, now: Date): string | null {
  if (!lastNudgeAt) return null;
  if (lastNudgeAt.getTime() > now.getTime()) return `adiado até ${fmtShort.format(new Date(lastNudgeAt.getTime() + 2 * DAY_MS))}`;
  const days = Math.floor((now.getTime() - lastNudgeAt.getTime()) / DAY_MS);
  return days <= 0 ? "cobrado hoje" : `cobrado há ${days}d`;
}
