"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { rejectQuoteByPublicId } from "@/actions/quotes";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function RejectButton({ publicId }: { publicId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await rejectQuoteByPublicId(publicId, reason);
      if (res.ok) toast.success("Orçamento recusado");
      else toast.error(res.error);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className="h-11 w-full text-muted-foreground">
          Recusar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Recusar orçamento?</AlertDialogTitle>
          <AlertDialogDescription>Se quiser, conte o motivo ao técnico (opcional).</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          aria-label="Motivo da recusa"
          placeholder="Ex.: achei o valor alto"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="text-base"
        />
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel className="h-12" disabled={pending}>
            Voltar
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-12"
            disabled={pending}
            onClick={(e) => {
              e.preventDefault();
              confirm();
            }}
          >
            {pending ? "Enviando..." : "Sim, recusar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
