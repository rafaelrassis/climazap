import { PrismaClient } from "@prisma/client";
import { funnel, nudgeEffect, referrals, weeklyCohorts } from "@/lib/metrics";

const DEFAULT_EXCLUDE = "@fechouclima\\.com\\.br$|^demo@";

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL não configurada. Rode com a URL do banco (ex.: a direta do Neon, fora da Vercel).");
    process.exit(1);
  }

  const host = (() => {
    try {
      return new URL(dbUrl).hostname;
    } catch {
      return "(não foi possível ler o host)";
    }
  })();
  console.log(`Rodando contra: ${host}\n`);

  const exclude = new RegExp(process.env.METRICAS_EXCLUIR ?? DEFAULT_EXCLUDE, "i");

  const db = new PrismaClient();
  try {
    const allUsers = await db.user.findMany({ select: { id: true, email: true, createdAt: true, referredById: true } });
    const keepIds = new Set(allUsers.filter((u) => !exclude.test(u.email)).map((u) => u.id));
    const kept = allUsers.filter((u) => keepIds.has(u.id));
    const userRows = kept.map((u) => ({ id: u.id, createdAt: u.createdAt }));
    const referralRows = kept.map((u) => ({ id: u.id, createdAt: u.createdAt, referredById: u.referredById && keepIds.has(u.referredById) ? u.referredById : null }));

    const quotes = await db.quote.findMany({
      where: { userId: { in: [...keepIds] } },
      select: { id: true, userId: true, sentAt: true, viewedAt: true, respondedAt: true, status: true },
    });
    const nudges = await db.quoteNudge.findMany({
      where: { userId: { in: [...keepIds] } },
      select: { quoteId: true, kind: true },
    });

    console.log(`Técnicos considerados: ${userRows.length} (de ${allUsers.length}, excluídas contas de teste)\n`);

    console.log("Coortes semanais — ativação: >=1 orçamento enviado em 7 dias; retenção: >=2 entre os dias 7-14");
    console.table(weeklyCohorts(userRows, quotes));

    console.log("\nFunil enviado -> visto -> aprovado, por semana de envio (mediana de horas até responder)");
    console.table(funnel(quotes));

    const effect = nudgeEffect(quotes, nudges, new Date());
    console.log("\nEfeito da cobrança — orçamentos sem resposta há 2+ dias, aprovado depois: cobrado vs. não cobrado");
    console.table({
      cobrado: { n: effect.cobrado.n, aprovadoPct: effect.cobrado.aprovadoPct ?? "amostra pequena" },
      naoCobrado: { n: effect.naoCobrado.n, aprovadoPct: effect.naoCobrado.aprovadoPct ?? "amostra pequena" },
    });

    const ref = referrals(referralRows, quotes);
    console.log(`\nIndicações — ${ref.totalIndicados} cadastros vieram de indicação, ${ref.ativacaoPct}% ativaram`);
    if (ref.porTecnico.length) console.table(ref.porTecnico);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
