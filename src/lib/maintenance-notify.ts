import { db } from "@/lib/db";
import { sendPushToUser } from "@/lib/push";

// Avisa cada técnico (1 push, não 1 por cliente) sobre lembretes de manutenção vencidos. Chamado
// de dentro do cron diário de expiração (não cria um 3º cron). Só marca reminderNotifiedAt se o
// push realmente foi entregue: sem aparelho cadastrado, tenta de novo no dia seguinte.
export async function notifyDueReminders(now: Date): Promise<{ notified: number }> {
  const due = await db.quote.findMany({
    where: { status: "APPROVED", reminderAt: { lte: now }, reminderDoneAt: null, reminderNotifiedAt: null },
    select: { id: true, userId: true },
  });
  if (due.length === 0) return { notified: 0 };

  const byUser = new Map<string, string[]>();
  for (const q of due) {
    const list = byUser.get(q.userId);
    if (list) list.push(q.id);
    else byUser.set(q.userId, [q.id]);
  }

  let notified = 0;
  for (const [userId, quoteIds] of byUser) {
    const n = quoteIds.length;
    const delivered = await sendPushToUser(userId, {
      title: n === 1 ? "1 cliente para chamar hoje" : `${n} clientes para chamar hoje`,
      body: "Lembrete de manutenção vencido.",
      url: "/inicio",
      tag: "lembretes",
    });
    if (delivered > 0) {
      await db.quote.updateMany({ where: { id: { in: quoteIds } }, data: { reminderNotifiedAt: now } });
      notified += n;
    }
  }
  return { notified };
}
