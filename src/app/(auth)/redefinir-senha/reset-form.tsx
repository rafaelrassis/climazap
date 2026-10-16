"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPassword } from "@/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full text-base shadow-[0_8px_16px_rgba(14,116,144,0.3)]" disabled={pending}>
      {pending ? "Salvando..." : "Salvar nova senha"}
    </Button>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, undefined);

  return (
    <AuthShell title="Nova senha" subtitle="Escolha uma senha com pelo menos 6 caracteres">
      {state?.ok ? (
        <div className="space-y-4">
          <p role="status" className="text-sm">
            Senha alterada. Agora é só entrar com a nova senha.
          </p>
          <Button asChild className="h-12 w-full text-base shadow-[0_8px_16px_rgba(14,116,144,0.3)]">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      ) : (
        <form action={action} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div className="space-y-2">
            <Label htmlFor="password">Nova senha</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Repita a senha</Label>
            <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={6} className="h-12 text-base" />
          </div>
          {state?.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <SubmitButton />
          <Link href="/esqueci-senha" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
            Pedir um novo link
          </Link>
        </form>
      )}
    </AuthShell>
  );
}
