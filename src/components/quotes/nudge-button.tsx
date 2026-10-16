"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { markQuoteNudged } from "@/actions/quotes";
import { Button } from "@/components/ui/button";

export function NudgeButton({ quoteId, href, nudged }: { quoteId: string; href: string; nudged: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      asChild
      className={
        nudged
          ? "h-11 shrink-0 border border-success bg-transparent px-4 text-success hover:bg-success/10"
          : "h-11 shrink-0 bg-success px-4 text-white hover:bg-success/90"
      }
      aria-disabled={pending}
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          startTransition(async () => {
            const res = await markQuoteNudged(quoteId);
            if (!res.ok) toast.error(res.error);
            else router.refresh();
          })
        }
      >
        {nudged ? "Cobrar de novo" : "Cobrar"}
      </a>
    </Button>
  );
}
