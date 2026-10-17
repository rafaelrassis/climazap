"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeMaintenanceReminder } from "@/actions/quotes";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";

export function CompleteReminderButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function finish(nextMonths: 3 | 6 | 12 | null) {
    startTransition(async () => {
      const res = await completeMaintenanceReminder(quoteId, nextMonths);
      setOpen(false);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(nextMonths ? `Próxima manutenção em ${nextMonths} meses` : "Lembrete concluído");
      router.refresh();
    });
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="ghost" className="h-11 shrink-0 text-muted-foreground">
          Feito
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Agendar a próxima manutenção?</DrawerTitle>
          <DrawerDescription>Marca este lembrete como feito e, se você quiser, já agenda o próximo.</DrawerDescription>
        </DrawerHeader>
        <DrawerFooter>
          <Button className="h-12" disabled={pending} onClick={() => finish(6)}>
            6 meses
          </Button>
          <Button variant="outline" className="h-12" disabled={pending} onClick={() => finish(12)}>
            12 meses
          </Button>
          <Button variant="ghost" className="h-12 text-muted-foreground" disabled={pending} onClick={() => finish(null)}>
            Não agendar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
