import { NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron-auth";
import { sendWeeklyDigest } from "@/lib/reminders";

export const dynamic = "force-dynamic";

// Chamado pelo cron da Vercel (que envia Authorization: Bearer $CRON_SECRET)
export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await sendWeeklyDigest();
  return NextResponse.json({ ok: true, ...result });
}
