"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { removeLogo, saveLogo } from "@/actions/settings";
import { MAX_LOGO_BYTES } from "@/lib/logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SIZE = 256;

// Reduz para no máximo 256px e converte para PNG (preserva transparência)
async function toPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, SIZE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao converter"))), "image/png"),
  );
}

export function LogoForm({ logoUrl }: { logoUrl: string | null }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const png = await toPng(file);
      if (png.size > MAX_LOGO_BYTES) {
        toast.error("Imagem complexa demais. Use uma logo mais simples.");
        return;
      }
      const fd = new FormData();
      fd.set("logo", new File([png], "logo.png", { type: "image/png" }));
      const res = await saveLogo(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Logo salva");
      router.refresh();
    } catch {
      toast.error("Não foi possível ler essa imagem");
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    startTransition(async () => {
      const res = await removeLogo();
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Logo removida");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <Label>Logo da empresa</Label>
      <p className="text-xs text-muted-foreground">Aparece no orçamento que o cliente abre e na prévia do WhatsApp.</p>
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="Logo atual" className="h-16 w-auto max-w-full rounded border bg-white object-contain p-1" />
      )}
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="h-11" disabled={busy || pending} onClick={() => input.current?.click()}>
          {busy ? "Enviando..." : logoUrl ? "Trocar logo" : "Enviar logo"}
        </Button>
        {logoUrl && (
          <Button type="button" variant="ghost" className="h-11 text-muted-foreground" disabled={busy || pending} onClick={remove}>
            Remover
          </Button>
        )}
      </div>
    </div>
  );
}
