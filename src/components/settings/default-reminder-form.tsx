"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveDefaultReminder } from "@/actions/settings";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { label: "Desligado", value: null },
  { label: "3 meses", value: 3 },
  { label: "6 meses", value: 6 },
  { label: "12 meses", value: 12 },
] as const;

// Vale só quando nenhum item do orçamento tem serviço com prazo próprio (ver "Lembrar o cliente
// após" no catálogo). Aplica-se apenas a aprovações futuras.
export function DefaultReminderForm({ initial }: { initial: number | null }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function pick(months: number | null) {
    const previous = value;
    setValue(months);
    startTransition(async () => {
      const res = await saveDefaultReminder(months);
      if (!res.ok) {
        setValue(previous);
        toast.error(res.error);
      } else toast.success("Lembrete padrão salvo");
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Lembrete automático</p>
      <p className="text-xs text-muted-foreground">
        Prazo padrão para avisar o cliente sobre manutenção, quando o serviço do orçamento não tem um prazo próprio.
      </p>
      <div className="grid grid-cols-4 gap-2">
        {OPTIONS.map((opt) => (
          <Button
            key={opt.label}
            type="button"
            variant={value === opt.value ? "default" : "outline"}
            className="h-11 px-1 text-xs"
            disabled={pending}
            onClick={() => pick(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
