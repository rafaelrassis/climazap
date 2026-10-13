export function normalizeBrPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  return `https://wa.me/${normalizeBrPhone(phone)}?text=${encodeURIComponent(message)}`;
}
