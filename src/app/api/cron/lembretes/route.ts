import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendWeeklyDigest } from "@/lib/reminders";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Chamado pelo cron da Vercel (que envia Authorization: Bearer $CRON_SECRET)
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await sendWeeklyDigest();
  return NextResponse.json({ ok: true, ...result });
}
