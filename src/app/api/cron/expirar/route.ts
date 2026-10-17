import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { notifyDueReminders } from "@/lib/maintenance-notify";
import { expireAllStaleQuotes } from "@/lib/quote-expiry";

export const dynamic = "force-dynamic";

// Diário: marca como EXPIRED todo orçamento SENT vencido, mesmo de técnico que não abriu o app.
// Também dispara o push de lembretes de manutenção vencidos (de propósito, pra não criar um 3º cron).
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const expired = await expireAllStaleQuotes();
  const { notified } = await notifyDueReminders(new Date());
  return NextResponse.json({ ok: true, expired, notified });
}
