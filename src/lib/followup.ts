const DAY_MS = 24 * 60 * 60 * 1000;

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

export function followUpMessage(q: { customerName: string; number: number; validUntil: Date | null }, now: Date): string {
  const d = daysUntilExpiry(q.validUntil, now);
  if (d !== null && d <= 1) {
    return `Oi, ${q.customerName}! O orçamento #${q.number} vence em breve. Consegue me confirmar para eu garantir o valor e reservar sua data?`;
  }
  return `Oi, ${q.customerName}! Conseguiu ver o orçamento #${q.number}? Qualquer dúvida é só falar.`;
}

export function nudgedLabel(lastNudgeAt: Date | null, now: Date): string | null {
  if (!lastNudgeAt) return null;
  const days = Math.floor((now.getTime() - lastNudgeAt.getTime()) / DAY_MS);
  return days <= 0 ? "cobrado hoje" : `cobrado há ${days}d`;
}
