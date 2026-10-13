"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { removePix, savePix } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const TYPE_LABEL: Record<string, string> = { CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Telefone", RANDOM: "Chave aleatória" };

export function PixForm({ initialKey, initialType, initialCity }: { initialKey: string; initialType: string; initialCity: string }) {
  const [key, setKey] = useState(initialKey);
  const [city, setCity] = useState(initialCity);
  const [saved, setSaved] = useState(initialKey ? { key: initialKey, type: initialType } : null);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await savePix(key, city);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Pix salvo");
      setSaved({ key: key.trim(), type: "" });
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await removePix();
      if (res.ok) {
        setKey("");
        setCity("");
        setSaved(null);
        toast.success("Pix removido");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="text-sm font-medium">Receber por Pix</p>
      <p className="text-xs text-muted-foreground">
        Depois que o cliente aprova, a página do orçamento mostra seu Pix (chave, QR Code e copia e cola) já com o valor.
        {saved?.type ? ` Chave atual: ${TYPE_LABEL[saved.type] ?? saved.type}.` : ""}
      </p>
      <div className="space-y-1">
        <Label htmlFor="pix-key">Chave Pix</Label>
        <Input
          id="pix-key"
          className="h-12 text-base"
          value={key}
          maxLength={120}
          autoComplete="off"
          placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
          onChange={(e) => setKey(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pix-city">Cidade do recebedor</Label>
        <Input id="pix-city" className="h-12 text-base" value={city} maxLength={60} autoComplete="off" onChange={(e) => setCity(e.target.value)} />
      </div>
      <Button className="h-12 w-full text-base" onClick={save} disabled={pending || key.trim().length < 1 || city.trim().length < 2}>
        {pending ? "Salvando..." : "Salvar Pix"}
      </Button>
      {saved && (
        <Button variant="ghost" className="h-11 w-full text-muted-foreground" onClick={remove} disabled={pending}>
          Remover Pix
        </Button>
      )}
    </div>
  );
}
