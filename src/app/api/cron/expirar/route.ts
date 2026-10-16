import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { expireAllStaleQuotes } from "@/lib/quote-expiry";

export const dynamic = "force-dynamic";

// Diário: marca como EXPIRED todo orçamento SENT vencido, mesmo de técnico que não abriu o app
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const expired = await expireAllStaleQuotes();
  return NextResponse.json({ ok: true, expired });
}
