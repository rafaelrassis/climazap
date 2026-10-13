"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { removeService, restoreDefaultService } from "@/actions/services";
import { Button } from "@/components/ui/button";

export function RemoveServiceButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="h-11 text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await removeService(id);
          if (!res.ok) toast.error(res.error);
          else toast.success("Serviço removido da lista");
        })
      }
    >
      Remover
    </Button>
  );
}

export function RestoreDefaultButton({ baseId, label }: { baseId: string; label: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      className="h-11"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await restoreDefaultService(baseId);
          if (!res.ok) toast.error(res.error);
          else toast.success("Padrão restaurado");
        })
      }
    >
      {label}
    </Button>
  );
}
