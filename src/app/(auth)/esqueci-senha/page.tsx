"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { requestPasswordReset } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
      {pending ? "Enviando..." : "Enviar link"}
    </Button>
  );
}

export default function EsqueciSenhaPage() {
  const [state, action] = useActionState(requestPasswordReset, undefined);

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Esqueci minha senha</CardTitle>
          <CardDescription>Enviamos um link para você criar uma nova senha</CardDescription>
        </CardHeader>
        <CardContent>
          {state?.ok ? (
            <div className="space-y-4">
              <p role="status" className="text-sm">
                Se esse e-mail tiver conta, você receberá o link em instantes. Confira também o spam. O link vale por 1 hora.
              </p>
              <Link href="/login" className="inline-flex min-h-11 items-center text-sm font-medium underline">
                Voltar para o login
              </Link>
            </div>
          ) : (
            <form action={action} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required className="h-12 text-base" />
              </div>
              {state?.error && (
                <p role="alert" className="text-sm text-destructive">
                  {state.error}
                </p>
              )}
              <SubmitButton />
              <Link href="/login" className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline">
                Voltar para o login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
