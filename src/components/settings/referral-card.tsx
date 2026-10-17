import { CopyButton } from "@/components/copy-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function ReferralCard({ link, count }: { link: string; count: number }) {
  const message = `Oi! Uso o FechouClima pra fazer orçamento de ar-condicionado em menos de 1 minuto no celular. Dá uma olhada: ${link}`;
  const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div>
          <p className="text-sm font-medium">Indique um colega</p>
          <p className="text-xs text-muted-foreground">Mande seu link para outro técnico. Sem recompensa por agora, só pra sabermos se funciona.</p>
        </div>
        <p className="break-all rounded-md border bg-muted/50 p-2 text-xs">{link}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <CopyButton text={link} label="Copiar link" success="Link copiado" className="h-11 flex-1" />
          <Button asChild className="h-11 flex-1">
            <a href={waUrl} target="_blank" rel="noopener">
              Enviar no WhatsApp
            </a>
          </Button>
        </div>
        <p className="text-xs font-medium text-muted-foreground">{plural(count, "colega criou conta", "colegas criaram conta")}</p>
      </CardContent>
    </Card>
  );
}
