"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { setMaintenanceReminder } from "@/actions/quotes";
import { Button } from "@/components/ui/button";

const OPTIONS = [3, 6, 12] as const;

export function MaintenanceReminder({
  quoteId,
  reminderLabel,
  done,
  reminderService,
}: {
  quoteId: string;
  reminderLabel: string | null; // "dd/mm/aaaa" quando há lembrete
  done: boolean;
  reminderService?: string | null; // origem do lembrete automático: nome do serviço, ou null = padrão do app
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function set(months: number | null) {
    startTransition(async () => {
      const res = await setMaintenanceReminder(quoteId, months);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(months === null ? "Lembrete removido" : `Lembrete em ${months} meses`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Lembrete de manutenção</p>
      {reminderLabel ? (
        <>
          <p className="text-sm text-muted-foreground">
            {done ? "Feito" : `Aviso em ${reminderLabel}`} · aparece no Início quando chegar a data.
          </p>
          <p className="text-xs text-muted-foreground">Origem: {reminderService ? `serviço ${reminderService}` : "padrão do app"}</p>
          <Button variant="outline" className="h-11 w-full" disabled={pending} onClick={() => set(null)}>
            Remover lembrete
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">Avisar para reabordar o cliente em:</p>
          <div className="grid grid-cols-3 gap-2">
            {OPTIONS.map((m) => (
              <Button key={m} variant="outline" className="h-11" disabled={pending} onClick={() => set(m)}>
                {m} meses
              </Button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
