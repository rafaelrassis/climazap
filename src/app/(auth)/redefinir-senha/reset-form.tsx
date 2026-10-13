"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { resetPassword } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
      {pending ? "Salvando..." : "Salvar nova senha"}
    </Button>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, undefined);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Nova senha</CardTitle>
          <CardDescription>Escolha uma senha com pelo menos 6 caracteres</CardDescription>
        </CardHeader>
        <CardContent>
          {state?.ok ? (
            <div className="space-y-4">
              <p role="status" className="text-sm">
                Senha alterada. Agora é só entrar com a nova senha.
              </p>
              <Button asChild className="h-12 w-full text-base">
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
        </CardContent>
      </Card>
    </main>
  );
}
