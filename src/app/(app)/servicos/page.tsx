import { listHiddenDefaults, listServices } from "@/actions/services";
import { formatBRL } from "@/lib/money";
import { RemoveServiceButton, RestoreDefaultButton } from "@/components/services/service-row-actions";
import { ServiceSheet } from "@/components/services/service-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Serviços" };

export default async function ServicosPage() {
  const [services, hidden] = await Promise.all([listServices(), listHiddenDefaults()]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Serviços</h1>
        <ServiceSheet service={null}>
          <Button className="h-11">Novo</Button>
        </ServiceSheet>
      </div>

      {services.map((s) => (
        <Card key={s.id}>
          <CardContent className="space-y-2 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium leading-snug">{s.name}</p>
                <p className="text-xs text-muted-foreground">por {s.unit}</p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatBRL(s.priceCents)}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-wrap gap-1">
                {s.overridesId && <Badge variant="secondary">Preço personalizado</Badge>}
                {!s.overridesId && s.userId && <Badge variant="outline">Meu serviço</Badge>}
                {s.reminderMonths && <Badge variant="outline">lembra em {s.reminderMonths} meses</Badge>}
              </div>
              <div className="flex gap-1">
                {s.overridesId && <RestoreDefaultButton baseId={s.overridesId} label="Voltar ao padrão" />}
                <ServiceSheet key={`${s.id}-${s.priceCents}`} service={s}>
                  <Button variant="outline" className="h-11">
                    Editar
                  </Button>
                </ServiceSheet>
                <RemoveServiceButton id={s.id} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {hidden.length > 0 && (
        <section className="space-y-2 pt-2">
          <h2 className="text-sm font-medium text-muted-foreground">Padrões ocultos</h2>
          {hidden.map((h) => (
            <div key={h.id} className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm">{h.name}</p>
              <RestoreDefaultButton baseId={h.overridesId!} label="Restaurar" />
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
