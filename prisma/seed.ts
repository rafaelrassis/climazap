import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

const DEFAULT_SERVICES = [
  { name: "Instalação de Split até 12.000 BTUs", unit: "un", priceCents: 45000, description: "Instalação completa com até 3m de tubulação" },
  { name: "Instalação de Split 18.000 a 24.000 BTUs", unit: "un", priceCents: 65000, description: "Instalação completa com até 3m de tubulação" },
  { name: "Instalação de Split 30.000+ BTUs", unit: "un", priceCents: 90000, description: "Instalação completa com até 3m de tubulação" },
  { name: "Metro adicional de tubulação", unit: "m", priceCents: 6500, description: "Cobre, isolamento e dreno" },
  { name: "Limpeza/higienização de Split", unit: "un", priceCents: 18000, description: "Evaporadora e condensadora" },
  { name: "Carga de gás R410A", unit: "un", priceCents: 25000, description: "Completa pressão e checa vazamentos" },
  { name: "Carga de gás R32", unit: "un", priceCents: 28000, description: "Completa pressão e checa vazamentos" },
  { name: "Manutenção preventiva", unit: "un", priceCents: 22000, description: "Limpeza, checagem elétrica e de pressão" },
  { name: "Visita técnica / diagnóstico", unit: "un", priceCents: 12000, description: "Abatida do valor se o serviço for aprovado" },
];

async function main() {
  // Serviços padrão do sistema (userId null), idempotente por nome
  for (const s of DEFAULT_SERVICES) {
    const exists = await db.service.findFirst({ where: { userId: null, name: s.name } });
    if (!exists) await db.service.create({ data: { ...s, userId: null } });
  }

  // Usuário demo: nunca em produção (senha pública)
  if (process.env.NODE_ENV !== "production") {
    await db.user.upsert({
      where: { email: "demo@fechouclima.com.br" },
      update: {},
      create: {
        name: "Técnico Demo",
        email: "demo@fechouclima.com.br",
        passwordHash: await bcrypt.hash("demo1234", 10),
        phone: "11999999999",
        companyName: "Demo Climatização",
      },
    });
  }

  console.log("Seed concluído");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
