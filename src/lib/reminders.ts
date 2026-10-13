import { db } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { formatBRL } from "@/lib/money";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LINES = 10;
const fmtMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

type Section = { title: string; lines: string[]; extra: number };

function section(title: string, all: string[]): Section | null {
  return all.length ? { title, lines: all.slice(0, MAX_LINES), extra: Math.max(all.length - MAX_LINES, 0) } : null;
}

// Resumo semanal por técnico: lembretes de manutenção vencidos + orçamentos sem resposta há 2+ dias.
// Respeita User.emailDigest (descadastro em /ajustes). Sem nada a mostrar, não envia.
export async function sendWeeklyDigest(now = new Date()): Promise<{ users: number; sent: number }> {
  const staleSince = new Date(now.getTime() - 2 * DAY_MS);
  const users = await db.user.findMany({
    where: {
      emailDigest: true,
      quotes: {
        some: {
          OR: [
            { status: "APPROVED", reminderAt: { lte: now }, reminderDoneAt: null },
            { status: "SENT", sentAt: { lte: staleSince }, validUntil: { gt: now } },
          ],
        },
      },
    },
    select: {
      email: true,
      quotes: {
        where: {
          OR: [
            { status: "APPROVED", reminderAt: { lte: now }, reminderDoneAt: null },
            { status: "SENT", sentAt: { lte: staleSince }, validUntil: { gt: now } },
          ],
        },
        orderBy: { createdAt: "asc" },
        select: { status: true, customerName: true, number: true, totalCents: true, respondedAt: true },
      },
    },
  });

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  let sent = 0;

  for (const u of users) {
    const maintenance = u.quotes
      .filter((q) => q.status === "APPROVED")
      .map((q) => `${q.customerName}${q.respondedAt ? ` (serviço de ${fmtMonth.format(q.respondedAt)})` : ""}`);
    const waiting = u.quotes
      .filter((q) => q.status === "SENT")
      .map((q) => `#${q.number} · ${q.customerName} · ${formatBRL(q.totalCents)}`);

    const sections = [
      section("Hora da manutenção", maintenance),
      section("Orçamentos sem resposta há mais de 2 dias", waiting),
    ].filter((s): s is Section => s !== null);
    if (!sections.length) continue;

    const total = maintenance.length + waiting.length;
    const subject = total === 1 ? "Resumo da semana: 1 cliente para chamar" : `Resumo da semana: ${total} clientes para chamar`;

    const text = [
      ...sections.flatMap((s) => [
        `${s.title}:`,
        ...s.lines.map((l) => `- ${l}`),
        s.extra ? `e mais ${s.extra}` : "",
        "",
      ]),
      `Chame pelo WhatsApp: ${base}/inicio`,
      `Para parar de receber este resumo: ${base}/ajustes`,
    ]
      .filter((l, i, a) => l !== "" || a[i - 1] !== "")
      .join("\n");

    const html =
      sections
        .map(
          (s) =>
            `<p><strong>${escapeHtml(s.title)}</strong></p><ul>${s.lines.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>` +
            (s.extra ? `<p>e mais ${s.extra}</p>` : ""),
        )
        .join("") +
      `<p><a href="${escapeHtml(base)}/inicio">Abrir o FechouClima</a></p>` +
      `<p style="color:#64748b;font-size:12px">Para parar de receber este resumo, desative em <a href="${escapeHtml(base)}/ajustes">Ajustes</a>.</p>`;

    if (await sendEmail({ to: u.email, subject, html, text })) sent++;
  }

  return { users: users.length, sent };
}
