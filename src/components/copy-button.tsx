"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text, label, success = "Copiado", className }: { text: string; label: string; success?: string; className?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      className={className ?? "h-11 w-full"}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success(success);
        } catch {
          toast.error("Não foi possível copiar");
        }
      }}
    >
      {label}
    </Button>
  );
}
