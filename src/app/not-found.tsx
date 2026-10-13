import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Página não encontrada</h1>
      <p className="max-w-xs text-sm text-muted-foreground">O endereço não existe ou o orçamento foi removido.</p>
      <Button asChild className="h-12 w-full max-w-xs text-base">
        <Link href="/inicio">Ir para o início</Link>
      </Button>
    </main>
  );
}
