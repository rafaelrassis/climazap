import type { Metadata } from "next";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Cancelar resumo semanal", robots: { index: false, follow: false } };

export default async function DescadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; t?: string; feito?: string }>;
}) {
  const { u = "", t = "", feito } = await searchParams;
  const valid = verifyUnsubscribeToken(u, t);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">FechouClima</CardTitle>
          <CardDescription>Resumo semanal por e-mail</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {feito ? (
            <p role="status" className="text-sm">
              Pronto. Você não receberá mais o resumo semanal. Para voltar a receber, ative em Ajustes dentro do app.
            </p>
          ) : valid ? (
            <form method="post" action={`/api/descadastro?${new URLSearchParams({ u, t })}`} className="space-y-4">
              <p className="text-sm">Deseja parar de receber o resumo semanal por e-mail?</p>
              <Button type="submit" className="h-12 w-full text-base">
                Sim, cancelar o resumo
              </Button>
            </form>
          ) : (
            <p role="alert" className="text-sm text-destructive">
              Link inválido ou expirado. Entre no app e desative em Ajustes.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
