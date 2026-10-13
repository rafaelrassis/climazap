import QRCode from "qrcode";
import { CopyButton } from "@/components/copy-button";
import { Card, CardContent } from "@/components/ui/card";
import { formatBRL } from "@/lib/money";

// Mostrado ao cliente só depois da aprovação. Tudo gerado no servidor a partir do payload do BR Code.
export async function PixCard({ payload, pixKey, totalCents }: { payload: string; pixKey: string; totalCents: number }) {
  const qr = await QRCode.toDataURL(payload, { margin: 1, width: 240, errorCorrectionLevel: "M" });
  return (
    <Card>
      <CardContent className="space-y-3 p-3">
        <div>
          <p className="text-sm font-semibold">Pagamento via Pix</p>
          <p className="text-xs text-muted-foreground">Valor: {formatBRL(totalCents)}. Confira o nome do recebedor antes de confirmar.</p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR Code do Pix" width={192} height={192} className="mx-auto rounded border bg-white p-1" />
        <p className="break-all text-center text-xs text-muted-foreground">Chave: {pixKey}</p>
        <CopyButton text={payload} label="Copiar Pix copia e cola" success="Pix copia e cola copiado" />
        <CopyButton text={pixKey} label="Copiar chave Pix" success="Chave copiada" />
      </CardContent>
    </Card>
  );
}
