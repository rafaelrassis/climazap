"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveBrandColor } from "@/actions/settings";
import { BRAND_COLORS } from "@/lib/brand";

export function BrandColorForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  function pick(hex: string) {
    const previous = value;
    setValue(hex);
    startTransition(async () => {
      const res = await saveBrandColor(hex);
      if (!res.ok) {
        setValue(previous);
        toast.error(res.error);
      } else toast.success("Cor salva");
    });
  }

  return (
    <fieldset className="space-y-2 rounded-md border p-3" disabled={pending}>
      <legend className="px-1 text-sm font-medium">Cor da sua marca</legend>
      <p className="text-xs text-muted-foreground">Aparece no botão de aprovar, no PDF e na prévia do WhatsApp.</p>
      <div role="radiogroup" aria-label="Cor da marca" className="grid grid-cols-4 gap-2">
        {BRAND_COLORS.map((c) => {
          const active = c.hex === value;
          return (
            <button
              key={c.hex}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={c.name}
              onClick={() => pick(c.hex)}
              className={`flex h-12 items-center justify-center rounded-md border-2 ${active ? "border-foreground" : "border-transparent"}`}
              style={{ backgroundColor: c.hex }}
            >
              {active && <span className="text-lg font-bold text-white">✓</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
