"use client";

import Link from "next/link";
import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useFormStatus } from "react-dom";
import { loginAction } from "@/actions/auth";
import { AuthShell } from "@/components/auth/auth-shell";
import { LegalLinks } from "@/components/legal/legal-links";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full text-base shadow-[0_8px_16px_rgba(14,116,144,0.3)]" disabled={pending}>
      {pending ? "Entrando..." : "Entrar"}
    </Button>
  );
}

function AccountDeletedNotice() {
  const deleted = useSearchParams().get("conta") === "excluida";
  return deleted ? (
    <p role="status" className="mb-4 rounded-md border p-3 text-sm">
      Sua conta e todos os seus dados foram excluídos.
    </p>
  ) : null;
}

export default function LoginPage() {
  const [state, action] = useActionState(loginAction, undefined);

  return (
    <AuthShell title="Entrar na sua conta" subtitle="Bem-vindo de volta." footer={<LegalLinks className="mt-4" />}>
      <Suspense>
        <AccountDeletedNotice />
      </Suspense>
      <form action={action} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required defaultValue={state?.email} key={state?.email} className="h-12 text-base" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Senha</Label>
          <Input id="password" name="password" type="password" autoComplete="current-password" required minLength={6} className="h-12 text-base" />
        </div>
        {state?.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <SubmitButton />
        <p className="text-center text-sm">
          <Link href="/esqueci-senha" className="inline-flex min-h-11 items-center font-medium text-primary underline">
            Esqueci minha senha
          </Link>
        </p>
        <p className="text-center text-sm text-muted-foreground">
          Sem conta?{" "}
          <Link href="/cadastro" className="inline-flex min-h-11 items-center font-medium text-foreground underline">
            Cadastre-se
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
