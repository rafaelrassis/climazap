"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { addQuotePhoto, removeQuotePhoto } from "@/actions/quotes";
import { MAX_PHOTOS_PER_QUOTE, MAX_PHOTO_BYTES } from "@/lib/image";
import { Button } from "@/components/ui/button";

const MAX_SIDE = 1280;

// Reduz para no máximo 1280px e converte para JPEG (fundo branco para PNG transparente)
async function toJpeg(file: File, quality: number): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("falha ao converter"))), "image/jpeg", quality));
}

export function PhotoManager({ quoteId, photos, editable }: { quoteId: string; photos: { id: string }[]; editable: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const full = photos.length >= MAX_PHOTOS_PER_QUOTE;

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      let blob = await toJpeg(file, 0.82);
      if (blob.size > MAX_PHOTO_BYTES) blob = await toJpeg(file, 0.6); // segunda tentativa, mais comprimida
      if (blob.size > MAX_PHOTO_BYTES) {
        toast.error("Foto pesada demais. Tente outra.");
        return;
      }
      const fd = new FormData();
      fd.set("photo", new File([blob], "foto.jpg", { type: "image/jpeg" }));
      const res = await addQuotePhoto(quoteId, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Foto adicionada");
      router.refresh();
    } catch {
      toast.error("Não foi possível ler essa imagem");
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await removeQuotePhoto(id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Foto removida");
        router.refresh();
      }
    });
  }

  if (!editable && photos.length === 0) return null;

  return (
    <section className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">
        Fotos ({photos.length}/{MAX_PHOTOS_PER_QUOTE})
      </p>
      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-2">
          {photos.map((p, i) => (
            <li key={p.id} className="space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fotos/${p.id}`} alt={`Foto ${i + 1} do orçamento`} className="aspect-square w-full rounded border object-cover" loading="lazy" />
              {editable && (
                <Button type="button" variant="ghost" className="h-11 w-full text-muted-foreground" disabled={pending} onClick={() => remove(p.id)}>
                  Remover foto {i + 1}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <>
          <input ref={input} type="file" accept="image/*" className="hidden" onChange={onPick} />
          <Button type="button" variant="outline" className="h-11 w-full" disabled={busy || pending || full} onClick={() => input.current?.click()}>
            {busy ? "Enviando..." : full ? "Limite de fotos atingido" : "Adicionar foto"}
          </Button>
          <p className="text-xs text-muted-foreground">O cliente vê as fotos na página do orçamento depois que você enviar.</p>
        </>
      )}
    </section>
  );
}
