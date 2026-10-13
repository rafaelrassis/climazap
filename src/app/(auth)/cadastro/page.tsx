"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { registerAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="h-12 w-full text-base" disabled={pending}>
      {pending ? "Criando conta..." : "Criar conta"}
    </Button>
  );
}

export default function CadastroPage() {
  const [state, action] = useActionState(registerAction, undefined);
  const fe = state?.fieldErrors;

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Criar conta</CardTitle>
          <CardDescription>Orçamentos em menos de 60 segundos</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" autoComplete="name" required minLength={2} className="h-12 text-base" />
              {fe?.name && <p className="text-sm text-destructive">{fe.name[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" required className="h-12 text-base" />
              {fe?.email && <p className="text-sm text-destructive">{fe.email[0]}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={6} className="h-12 text-base" />
              {fe?.password && <p className="text-sm text-destructive">{fe.password[0]}</p>}
            </div>
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <SubmitButton />
            <p className="text-center text-sm text-muted-foreground">
              Já tem conta?{" "}
              <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-foreground underline">
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
