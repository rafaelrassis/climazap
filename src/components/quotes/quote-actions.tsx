"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { duplicateQuote, sendQuoteViaWhatsApp } from "@/actions/quotes";
import { Button } from "@/components/ui/button";

export function QuoteActions({
  quoteId,
  publicId,
  isDraft,
}: {
  quoteId: string;
  publicId: string;
  isDraft: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const res = await sendQuoteViaWhatsApp(quoteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.assign(res.data.url);
    });
  }

  function duplicate() {
    startTransition(async () => {
      const res = await duplicateQuote(quoteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Duplicado como rascunho");
      router.push(`/orcamentos/${res.data.id}`);
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/o/${publicId}`);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  return (
    <div className="space-y-2">
      <Button className="h-12 w-full text-base" onClick={send} disabled={pending}>
        {isDraft ? "Enviar no WhatsApp" : "Reenviar no WhatsApp"}
      </Button>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11" onClick={copyLink}>
          Copiar link
        </Button>
        <Button variant="outline" className="h-11" onClick={duplicate} disabled={pending}>
          Duplicar
        </Button>
      </div>
    </div>
  );
}
