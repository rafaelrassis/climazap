"use client";

import { useActionState, useState } from "react";
import { deleteAccount } from "@/actions/auth";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AccountSection() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(deleteAccount, undefined);

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Seus dados</p>
      <p className="text-xs text-muted-foreground">
        Baixe uma cópia de tudo (conta, clientes, serviços e orçamentos) ou exclua sua conta de forma definitiva.
      </p>
      <Button asChild variant="outline" className="h-11 w-full">
        <a href="/api/meus-dados" download>
          Baixar meus dados
        </a>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="h-11 w-full text-destructive">
            Excluir minha conta
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir a conta?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apaga para sempre sua conta, seus clientes, serviços e orçamentos. Os links já enviados deixam de funcionar. Não dá para
              desfazer. Baixe seus dados antes, se precisar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={action} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="del-password">Digite sua senha para confirmar</Label>
              <Input id="del-password" name="password" type="password" autoComplete="current-password" required className="h-12 text-base" />
            </div>
            {state?.error && (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            )}
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel type="button" className="h-12" disabled={pending}>
                Voltar
              </AlertDialogCancel>
              <Button type="submit" variant="destructive" className="h-12" disabled={pending}>
                {pending ? "Excluindo..." : "Excluir definitivamente"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
