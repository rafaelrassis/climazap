import Link from "next/link";
import { db } from "@/lib/db";
import { customerStats, isDormant } from "@/lib/customers";
import { formatBRL } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Clientes" };

function maskPhone(d: string) {
  const n = d.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d;
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string; ordem?: string; filtro?: string }> }) {
  const userId = await requireUserId();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const byValue = sp.ordem === "valor";
  const onlyDormant = sp.filtro === "dormentes";
  const digits = q.replace(/\D/g, "");

  const [customers, stats] = await Promise.all([
    db.customer.findMany({
      where: {
        userId,
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : [])] }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
      take: 500,
      select: { id: true, name: true, phone: true, createdAt: true },
    }),
    customerStats(userId),
  ]);

  const now = new Date();
  const rows = customers
    .map((c) => ({ ...c, stats: stats.get(c.id), dormant: isDormant(stats.get(c.id), c.createdAt, now) }))
    .filter((c) => !onlyDormant || c.dormant)
    .sort((a, b) => (byValue ? (b.stats?.approvedCents ?? 0) - (a.stats?.approvedCents ?? 0) : 0))
    .slice(0, 100);

  const href = (over: { ordem?: string; filtro?: string }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    const ordem = "ordem" in over ? over.ordem : sp.ordem;
    const filtro = "filtro" in over ? over.filtro : sp.filtro;
    if (ordem) p.set("ordem", ordem);
    if (filtro) p.set("filtro", filtro);
    return `/clientes${p.size ? `?${p}` : ""}`;
  };
  const chip = (active: boolean) =>
    `inline-flex min-h-11 items-center rounded-full border px-4 text-sm ${active ? "bg-foreground text-background" : ""}`;

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">Clientes</h1>

      <form role="search">
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por nome ou telefone"
          aria-label="Buscar cliente"
          className="h-12 text-base"
        />
      </form>

      <div className="flex flex-wrap gap-2">
        <Link href={href({ ordem: byValue ? undefined : "valor" })} className={chip(byValue)}>
          Maior valor aprovado
        </Link>
        <Link href={href({ filtro: onlyDormant ? undefined : "dormentes" })} className={chip(onlyDormant)}>
          Sem orçamento há 6+ meses
        </Link>
      </div>

      {rows.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {q || onlyDormant ? "Nenhum cliente encontrado." : "Os clientes aparecem aqui conforme você cria orçamentos."}
        </p>
      )}

      {rows.map((c) => {
        const s = c.stats;
        return (
          <Card key={c.id}>
            <CardContent className="flex items-center justify-between gap-2 p-3">
              <Link href={`/clientes/${c.id}`} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                <span className="truncate text-sm font-medium">{c.name}</span>
                <span className="text-xs text-muted-foreground">
                  {maskPhone(c.phone)} · {s?.quotes ?? 0} {s?.quotes === 1 ? "orçamento" : "orçamentos"} ·{" "}
                  {formatBRL(s?.approvedCents ?? 0)}
                </span>
                {c.dormant && (
                  <Badge variant="outline" className="mt-1 w-fit">
                    Dormente
                  </Badge>
                )}
              </Link>
              {c.dormant && (
                <Button asChild variant="outline" className="h-11 shrink-0">
                  <a
                    href={buildWhatsAppUrl(
                      c.phone,
                      `Oi, ${c.name}! Faz um tempo que não nos falamos. Posso ajudar com limpeza ou manutenção do seu ar-condicionado?`,
                    )}
                  >
                    Reabordar
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
