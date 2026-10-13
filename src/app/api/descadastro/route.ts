import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyUnsubscribeToken } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

// POST: um clique do cliente de e-mail (RFC 8058) ou o botão da página /descadastro.
// GET não altera nada: scanners de e-mail abrem links sozinhos.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const userId = url.searchParams.get("u") ?? "";
  const token = url.searchParams.get("t") ?? "";
  if (!verifyUnsubscribeToken(userId, token)) return NextResponse.json({ error: "invalid" }, { status: 403 });

  await db.user.updateMany({ where: { id: userId }, data: { emailDigest: false } });

  const wantsPage = (req.headers.get("accept") ?? "").includes("text/html");
  return wantsPage
    ? NextResponse.redirect(new URL("/descadastro?feito=1", req.url), 303)
    : NextResponse.json({ ok: true });
}
