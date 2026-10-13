"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { approveQuoteByPublicId } from "@/actions/quotes";
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

export function ApproveButton({ publicId, totalLabel }: { publicId: string; totalLabel: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const res = await approveQuoteByPublicId(publicId);
      if (res.ok) toast.success("Orçamento aprovado!");
      else toast.error(res.error);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button className="h-12 w-full text-base">Aprovar orçamento</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar aprovação?</AlertDialogTitle>
          <AlertDialogDescription>
            Você está aprovando este orçamento no valor de {totalLabel}. O técnico será avisado.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
            {pending ? "Aprovando..." : "Sim, aprovar"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
