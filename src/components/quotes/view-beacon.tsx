"use client";

import { useEffect } from "react";
import { markQuoteViewed } from "@/actions/quotes";

// Registra a 1ª abertura do link pelo cliente. A página pública tem cache (revalidate = 300),
// então o registro não pode acontecer no render do servidor; só roda com a aba visível
// (prévias/robôs do WhatsApp não executam JS, por isso não contam).
export function ViewBeacon({ publicId }: { publicId: string }) {
  useEffect(() => {
    if (document.visibilityState === "visible") {
      void markQuoteViewed(publicId);
    }
  }, [publicId]);

  return null;
}
