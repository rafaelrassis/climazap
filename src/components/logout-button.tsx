"use client";

import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

// Limpa rascunhos locais (fc:draft:*) antes de sair: aparelho pode ser compartilhado
export function LogoutButton({ className }: { className?: string }) {
  return (
    <form
      action={logoutAction}
      onSubmit={() => {
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith("fc:draft:"))
            .forEach((k) => localStorage.removeItem(k));
        } catch {
          // ignora
        }
      }}
    >
      <Button variant="ghost" size="sm" type="submit" className={className ?? "min-h-11"}>
        Sair
      </Button>
    </form>
  );
}
