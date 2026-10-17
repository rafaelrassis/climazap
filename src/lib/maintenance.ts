// Soma meses sem estourar o mês (31/ago + 6 -> 28/fev, nunca 3/mar): fixa no dia 1 antes de mudar
// o mês e só então volta pro dia original, limitado ao último dia do mês de destino.
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + months);
  const lastDayOfTargetMonth = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
  result.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return result;
}

export type ReminderServiceInfo = { name: string; reminderMonths: number | null; reminderText: string | null };
export type ReminderItem = { service: ReminderServiceInfo | null };
export type ResolvedReminder = { months: number; text: string | null; service: string | null };

// Entre os itens cujo serviço tem reminderMonths, vale o de menor prazo (empate: o primeiro da
// lista). Sem nenhum, usa o padrão do técnico (service = null, é o padrão do app, não um serviço).
// defaultMonths null e nenhum item com lembrete -> sem lembrete (null).
export function resolveReminder(items: ReminderItem[], defaultMonths: number | null): ResolvedReminder | null {
  const withReminder = items
    .map((i) => i.service)
    .filter((s): s is ReminderServiceInfo & { reminderMonths: number } => !!s && s.reminderMonths !== null);

  if (withReminder.length > 0) {
    const best = withReminder.reduce((min, s) => (s.reminderMonths < min.reminderMonths ? s : min));
    return { months: best.reminderMonths, text: best.reminderText, service: best.name };
  }

  if (defaultMonths !== null) return { months: defaultMonths, text: null, service: null };

  return null;
}

export const MAINTENANCE_PLACEHOLDERS = ["{cliente}", "{tecnico}", "{servico}"] as const;
export const DEFAULT_MAINTENANCE_TEMPLATE =
  "Oi, {cliente}! Aqui é {tecnico}. Já faz um tempo desde o último serviço ({servico}) no seu ar-condicionado. Que tal agendar a manutenção preventiva?";

export function renderMaintenanceMessage(
  vars: { cliente: string; tecnico: string; servico: string },
  text: string | null,
): string {
  const template = text ?? DEFAULT_MAINTENANCE_TEMPLATE;
  return template
    .split("{cliente}").join(vars.cliente)
    .split("{tecnico}").join(vars.tecnico)
    .split("{servico}").join(vars.servico);
}
