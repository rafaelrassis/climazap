"use client";

import { useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { createService, updateService } from "@/actions/services";
import { MoneyInput } from "@/components/money-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export type ServiceRow = {
  id: string;
  name: string;
  unit: string;
  priceCents: number;
  userId: string | null;
};

// service = null -> novo. Serviço padrão (userId null): só o preço é editável.
export function ServiceSheet({ service, children }: { service: ServiceRow | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(service?.name ?? "");
  const [unit, setUnit] = useState(service?.unit ?? "un");
  const [priceCents, setPriceCents] = useState(service?.priceCents ?? 0);
  const isDefault = !!service && service.userId === null;

  function save() {
    startTransition(async () => {
      const payload = { name: name.trim(), unit: unit.trim() || "un", priceCents };
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
      }
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
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
          <Button className="h-12 w-full text-base" onClick={save} disabled={pending || name.trim().length < 2}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
