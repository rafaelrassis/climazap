import Link from "next/link";
import { db } from "@/lib/db";
import { customerStats } from "@/lib/customers";
import { formatBRL } from "@/lib/money";
import { requireUserId } from "@/lib/session";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const metadata = { title: "Clientes" };

function maskPhone(d: string) {
  const n = d.replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return d;
}

export default async function ClientesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const userId = await requireUserId();
  const q = ((await searchParams).q ?? "").trim().slice(0, 60);
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
      take: 100,
      select: { id: true, name: true, phone: true },
    }),
    customerStats(userId),
  ]);

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

      {customers.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {q ? "Nenhum cliente encontrado." : "Os clientes aparecem aqui conforme você cria orçamentos."}
        </p>
      )}

      {customers.map((c) => {
        const s = stats.get(c.id);
        return (
          <Link key={c.id} href={`/clientes/${c.id}`} className="block">
            <Card>
              <CardContent className="flex min-h-11 items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {maskPhone(c.phone)} · {s?.quotes ?? 0} {s?.quotes === 1 ? "orçamento" : "orçamentos"}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold">{formatBRL(s?.approvedCents ?? 0)}</p>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
