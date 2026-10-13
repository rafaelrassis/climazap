"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { duplicateQuote, renewQuote, sendQuoteViaWhatsApp, setQuotePaid } from "@/actions/quotes";
import { normalizeBrPhone } from "@/lib/whatsapp";
import { Button } from "@/components/ui/button";
import type { QuoteStatus } from "@prisma/client";

export function QuoteActions({
  quoteId,
  publicId,
  status,
  customerPhone,
  paid,
}: {
  quoteId: string;
  publicId: string;
  status: QuoteStatus;
  customerPhone: string;
  paid: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const canSend = status === "DRAFT" || status === "SENT";

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

  function duplicate(discountPercent = 0) {
    startTransition(async () => {
      const res = await duplicateQuote(quoteId, discountPercent);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Duplicado como rascunho");
      router.push(`/orcamentos/${res.data.id}`);
    });
  }

  function renew() {
    startTransition(async () => {
      const res = await renewQuote(quoteId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Validade renovada por 7 dias");
      router.refresh();
    });
  }

  function togglePaid() {
    startTransition(async () => {
      const res = await setQuotePaid(quoteId, !paid);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(paid ? "Marcado como a receber" : "Marcado como pago");
      router.refresh();
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
      {canSend && (
        <Button className="h-12 w-full text-base" onClick={send} disabled={pending}>
          {status === "DRAFT" ? "Enviar no WhatsApp" : "Reenviar no WhatsApp"}
        </Button>
      )}
      {status === "APPROVED" && (
        <Button
          variant={paid ? "outline" : "default"}
          className="h-12 w-full text-base"
          onClick={togglePaid}
          disabled={pending}
        >
          {paid ? "Desmarcar pagamento" : "Marcar como pago"}
        </Button>
      )}
      {status === "EXPIRED" && (
        <Button className="h-12 w-full text-base" onClick={renew} disabled={pending}>
          Renovar validade (7 dias)
        </Button>
      )}
      {status === "REJECTED" && (
        <Button className="h-12 w-full text-base" onClick={() => duplicate(5)} disabled={pending}>
          Contraproposta com 5% de desconto
        </Button>
      )}
      {status !== "APPROVED" && (
        <Button asChild variant="outline" className="h-11 w-full">
          <Link href={`/orcamentos/${quoteId}/editar`}>Editar</Link>
        </Button>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-11" onClick={copyLink}>
          Copiar link
        </Button>
        <Button variant="outline" className="h-11" onClick={() => duplicate()} disabled={pending}>
          Duplicar
        </Button>
      </div>
      <Button asChild variant="ghost" className="h-11 w-full">
        <a href={`tel:+${normalizeBrPhone(customerPhone)}`}>Ligar para o cliente</a>
      </Button>
    </div>
  );
}
