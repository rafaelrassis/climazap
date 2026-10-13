"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetWaTemplate, saveWaTemplate } from "@/actions/settings";
import { WA_MODELS, WA_PLACEHOLDERS, renderWaTemplate } from "@/lib/wa-template";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WaTemplateForm({ initial, sender }: { initial: string; sender: string }) {
  const [text, setText] = useState(initial);
  const [pending, startTransition] = useTransition();

  const preview = renderWaTemplate(text, {
    cliente: "Maria",
    valor: "R$ 450,00",
    link: "https://fechouclima.com.br/o/...",
    numero: 12,
    tecnico: sender,
  });

  const unknown = Array.from(new Set(text.match(/\{[^{}\s]*\}/g) ?? [])).filter(
    (v) => !(WA_PLACEHOLDERS as readonly string[]).includes(v),
  );

  function save() {
    startTransition(async () => {
      const res = await saveWaTemplate(text);
      if (res.ok) toast.success("Mensagem salva");
      else toast.error(res.error);
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetWaTemplate();
      if (res.ok) {
        setText(WA_MODELS[1].text);
        toast.success("Voltou ao modelo padrão");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {WA_MODELS.map((m) => (
          <Button key={m.id} type="button" variant="outline" className="h-11" onClick={() => setText(m.text)}>
            {m.label}
          </Button>
        ))}
      </div>

      <div className="space-y-1">
        <Label htmlFor="wa-text">Mensagem do WhatsApp</Label>
        <Textarea
          id="wa-text"
          rows={6}
          maxLength={600}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">
          Variáveis: {WA_PLACEHOLDERS.join(" ")} · {"{link}"} é obrigatória
        </p>
      </div>

      {unknown.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          Variável desconhecida: {unknown.join(" ")}. Ela iria literal para o cliente.
        </p>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="mb-1 text-xs text-muted-foreground">Prévia</p>
          <p className="whitespace-pre-line text-sm">{preview}</p>
        </CardContent>
      </Card>

      <Button className="h-12 w-full text-base" onClick={save} disabled={pending || unknown.length > 0}>
        {pending ? "Salvando..." : "Salvar mensagem"}
      </Button>
      <Button variant="ghost" className="h-11 w-full text-muted-foreground" onClick={reset} disabled={pending}>
        Voltar ao padrão
      </Button>
    </div>
  );
}
