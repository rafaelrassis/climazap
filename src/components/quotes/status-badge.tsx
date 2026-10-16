import type { QuoteStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import { STATUS_BADGE_STYLE, STATUS_LABEL } from "@/lib/quote-status";

export function StatusBadge({ status, className }: { status: QuoteStatus; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold", STATUS_BADGE_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </span>
  );
}
