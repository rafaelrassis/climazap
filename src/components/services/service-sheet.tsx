"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { createService, updateService } from "@/actions/services";
import { MAINTENANCE_PLACEHOLDERS, renderMaintenanceMessage } from "@/lib/maintenance";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";

type ReminderMonths = 3 | 6 | 12 | null;

export type ServiceRow = {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  userId: string | null;
  reminderMonths: number | null;
  reminderText: string | null;
};

const REMINDER_OPTIONS: { label: string; value: ReminderMonths }[] = [
  { label: "Nunca", value: null },
  { label: "3 meses", value: 3 },
  { label: "6 meses", value: 6 },
  { label: "12 meses", value: 12 },
];

// service = null -> novo. Serviço padrão (userId null): só o preço é editável.
export function ServiceSheet({ service, children }: { service: ServiceRow | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(service?.name ?? "");
  const [unit, setUnit] = useState(service?.unit ?? "un");
  const [priceCents, setPriceCents] = useState(service?.priceCents ?? 0);
  // só pode ser 3, 6, 12 ou null (REMINDER_OPTIONS); o tipo largo vem do Prisma (Int?)
  const [reminderMonths, setReminderMonths] = useState<ReminderMonths>((service?.reminderMonths ?? null) as ReminderMonths);
  const [reminderText, setReminderText] = useState(service?.reminderText ?? "");
  const isDefault = !!service && service.userId === null;

  const preview = renderMaintenanceMessage({ cliente: "Maria", tecnico: "Zé Frio", servico: name || "serviço" }, reminderText || null);
  const unknown = Array.from(new Set(reminderText.match(/\{[^{}\s]*\}/g) ?? [])).filter(
    (v) => !(MAINTENANCE_PLACEHOLDERS as readonly string[]).includes(v),
  );

  function save() {
    startTransition(async () => {
      const payload = {
        name: name.trim(),
        unit: unit.trim() || "un",
        priceCents,
        reminderMonths,
        reminderText: reminderMonths === null ? null : reminderText.trim() || null,
      };
      const res = service
        ? await updateService({ id: service.id, ...payload })
        : await createService(payload);
      if (!res.ok) {
        const first = Object.values(res.fieldErrors ?? {}).flat()[0];
        toast.error(first ?? res.error);
        return;
      }
      toast.success("Serviço salvo");
      if (!service) {
        setName("");
        setUnit("un");
        setPriceCents(0);
        setReminderMonths(null);
        setReminderText("");
      }
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="overflow-y-auto rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>{service ? "Editar serviço" : "Novo serviço"}</SheetTitle>
          <SheetDescription>
            {isDefault
              ? "Serviço padrão: só o seu preço muda, o padrão do sistema continua igual."
              : "Aparece na lista ao criar orçamentos."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="svc-name">Nome</Label>
            <Input
              id="svc-name"
              className="h-12 text-base"
              value={name}
              maxLength={120}
              disabled={isDefault}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="svc-unit">Unidade</Label>
              <Input
                id="svc-unit"
                className="h-12 text-base"
                value={unit}
                maxLength={10}
                disabled={isDefault}
                onChange={(e) => setUnit(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Preço</Label>
              <MoneyInput label="Preço" value={priceCents} onChange={setPriceCents} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Lembrar o cliente após</Label>
            <div className="grid grid-cols-4 gap-2">
              {REMINDER_OPTIONS.map((opt) => (
                <Button
                  key={opt.label}
                  type="button"
                  variant={reminderMonths === opt.value ? "default" : "outline"}
                  className="h-11 px-1 text-xs"
                  disabled={isDefault}
                  onClick={() => setReminderMonths(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          {reminderMonths !== null && (
            <div className="space-y-1">
              <Label htmlFor="svc-reminder-text">Mensagem do lembrete (opcional)</Label>
              <Textarea
                id="svc-reminder-text"
                rows={3}
                maxLength={300}
                value={reminderText}
                disabled={isDefault}
                onChange={(e) => setReminderText(e.target.value)}
                className="text-base"
              />
              <p className="text-xs text-muted-foreground">
                Variáveis: {MAINTENANCE_PLACEHOLDERS.join(" ")}. Vazio usa a mensagem padrão.
              </p>
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
            </div>
          )}

          <Button className="h-12 w-full text-base" onClick={save} disabled={pending || name.trim().length < 2 || unknown.length > 0}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
