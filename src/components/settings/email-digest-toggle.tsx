"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveEmailDigest } from "@/actions/settings";

export function EmailDigestToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle(next: boolean) {
    setEnabled(next);
    startTransition(async () => {
      const res = await saveEmailDigest(next);
      if (!res.ok) {
        setEnabled(!next);
        toast.error(res.error);
        return;
      }
      toast.success(next ? "Resumo semanal ativado" : "Resumo semanal desativado");
    });
  }

  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3">
      <input
        type="checkbox"
        className="mt-1 size-5 shrink-0"
        checked={enabled}
        disabled={pending}
        onChange={(e) => toggle(e.target.checked)}
      />
      <span className="space-y-0.5">
        <span className="block text-sm font-medium">Resumo semanal por e-mail</span>
        <span className="block text-xs text-muted-foreground">
          Segunda de manhã: clientes na hora da manutenção e orçamentos sem resposta.
        </span>
      </span>
    </label>
  );
}
