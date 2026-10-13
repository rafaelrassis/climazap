"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Algo deu errado</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        Já fomos avisados. Tente de novo; se continuar, volte em alguns minutos.
      </p>
      <Button className="h-12 w-full max-w-xs text-base" onClick={reset}>
        Tentar de novo
      </Button>
    </main>
  );
}
