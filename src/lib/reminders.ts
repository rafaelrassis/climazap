import { db } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";

const fmtMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

// Um e-mail por técnico com os lembretes de manutenção vencidos e não concluídos.
export async function sendDueReminderEmails(now = new Date()): Promise<{ users: number; sent: number }> {
  const due = await db.quote.findMany({
    where: { reminderAt: { lte: now }, reminderDoneAt: null, status: "APPROVED" },
    orderBy: { reminderAt: "asc" },
    select: {
      customerName: true,
      respondedAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  const byUser = new Map<string, { email: string; name: string; items: typeof due }>();
  for (const q of due) {
    const entry = byUser.get(q.user.id) ?? { email: q.user.email, name: q.user.name, items: [] };
    entry.items.push(q);
    byUser.set(q.user.id, entry);
  }

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  let sent = 0;

  for (const { email, items } of Array.from(byUser.values())) {
    const lines = items.slice(0, 10).map((i) => {
      const when = i.respondedAt ? ` (serviço de ${fmtMonth.format(i.respondedAt)})` : "";
      return `${i.customerName}${when}`;
    });
    const extra = items.length > 10 ? `e mais ${items.length - 10}` : "";
    const subject =
      items.length === 1 ? "1 cliente para chamar para manutenção" : `${items.length} clientes para chamar para manutenção`;

    const text = [
      "Estes clientes estão na hora da manutenção:",
      ...lines.map((l) => `- ${l}`),
      extra,
      `Chame pelo WhatsApp: ${base}/inicio`,
    ]
      .filter(Boolean)
      .join("\n");
    const html =
      "<p>Estes clientes estão na hora da manutenção:</p><ul>" +
      lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("") +
      "</ul>" +
      (extra ? `<p>${escapeHtml(extra)}</p>` : "") +
      `<p><a href="${escapeHtml(base)}/inicio">Abrir o FechouClima</a></p>`;

    if (await sendEmail({ to: email, subject, html, text })) sent++;
  }

  return { users: byUser.size, sent };
}
