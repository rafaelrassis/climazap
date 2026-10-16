"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { resetNudgeTemplate, saveNudgeTemplate } from "@/actions/settings";
import { DEFAULT_NUDGE_TEMPLATE, NUDGE_PLACEHOLDERS } from "@/lib/followup";
import { renderWaTemplate } from "@/lib/wa-template";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function NudgeTemplateForm({ initial, sender }: { initial: string; sender: string }) {
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
    (v) => !(NUDGE_PLACEHOLDERS as readonly string[]).includes(v),
  );

  function save() {
    startTransition(async () => {
      const res = await saveNudgeTemplate(text);
      if (res.ok) toast.success("Mensagem de cobrança salva");
      else toast.error(res.error);
    });
  }

  function reset() {
    startTransition(async () => {
      const res = await resetNudgeTemplate();
      if (res.ok) {
        setText(DEFAULT_NUDGE_TEMPLATE);
        toast.success("Voltou ao modelo padrão");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-3">
      <h2 className="text-[15px] font-bold">Mensagem de cobrança</h2>
      <div className="space-y-1">
        <Label htmlFor="nudge-text">Mensagem enviada pelo botão Cobrar</Label>
        <Textarea
          id="nudge-text"
          rows={4}
          maxLength={400}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="text-base"
        />
        <p className="text-xs text-muted-foreground">
          Variáveis: {NUDGE_PLACEHOLDERS.join(" ")}. Quando o orçamento vence em até 24h, usamos um aviso de urgência.
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
        {pending ? "Salvando..." : "Salvar mensagem de cobrança"}
      </Button>
      <Button variant="ghost" className="h-11 w-full text-muted-foreground" onClick={reset} disabled={pending}>
        Voltar ao padrão
      </Button>
    </div>
  );
}
