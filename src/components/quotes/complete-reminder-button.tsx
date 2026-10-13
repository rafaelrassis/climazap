"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { completeMaintenanceReminder } from "@/actions/quotes";
import { Button } from "@/components/ui/button";

export function CompleteReminderButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="h-11 shrink-0 text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await completeMaintenanceReminder(quoteId);
          if (!res.ok) toast.error(res.error);
          else router.refresh();
        })
      }
    >
      Feito
    </Button>
  );
}
