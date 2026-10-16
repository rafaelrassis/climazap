import type { QuoteStatus } from "@prisma/client";

export const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Rascunho",
  SENT: "Enviado",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  EXPIRED: "Expirado",
};

export const STATUS_VARIANT: Record<QuoteStatus, "default" | "secondary" | "destructive" | "outline"> = {
  DRAFT: "outline",
  SENT: "secondary",
  APPROVED: "default",
  REJECTED: "destructive",
  EXPIRED: "outline",
};

export const STATUS_BADGE_STYLE: Record<QuoteStatus, string> = {
  DRAFT: "bg-warning-bg text-warning",
  SENT: "bg-info-bg text-info",
  APPROVED: "bg-success-bg text-success",
  REJECTED: "bg-error-bg text-error",
  EXPIRED: "bg-expired-bg text-expired",
};
