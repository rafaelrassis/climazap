"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { snoozeQuoteFollowUp } from "@/actions/quotes";
import { Button } from "@/components/ui/button";

export function SnoozeButton({ quoteId }: { quoteId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="ghost"
      className="h-11 shrink-0 text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await snoozeQuoteFollowUp(quoteId);
          if (!res.ok) toast.error(res.error);
          else {
            toast.success("Cobrança adiada por 3 dias");
            router.refresh();
          }
        })
      }
    >
      Adiar 3 dias
    </Button>
  );
}
