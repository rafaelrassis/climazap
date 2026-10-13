import { createHash } from "node:crypto";
import { escapeHtml, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";

const seen = new Map<string, number>(); // dedupe em memória (por instância), caso o banco também esteja fora
const WINDOW_MS = 60 * 60 * 1000;

export type ErrorContext = { path: string; method: string; routeType?: string; routePath?: string };

// Alerta de erro de servidor por e-mail para o dono do app (ERROR_ALERT_EMAIL). Nunca lança.
// Sem dados pessoais: só caminho (sem query), método, mensagem truncada e o topo da pilha.
export async function reportError(err: unknown, ctx: ErrorContext): Promise<void> {
  try {
    const e = err instanceof Error ? err : new Error(String(err));
    const path = ctx.path.split("?")[0].slice(0, 200);
    const fingerprint = createHash("sha1").update(`${e.name}:${e.message.split("\n")[0]}:${ctx.routePath ?? path}`).digest("hex");

    console.error(
      JSON.stringify({ level: "error", fingerprint, name: e.name, message: e.message.slice(0, 300), path, method: ctx.method, routeType: ctx.routeType }),
    );

    const to = process.env.ERROR_ALERT_EMAIL;
    if (!to) return;

    const now = Date.now();
    if ((seen.get(fingerprint) ?? 0) > now - WINDOW_MS) return;
    seen.set(fingerprint, now);
    if (seen.size > 500) for (const k of Array.from(seen.keys()).slice(0, 250)) seen.delete(k);

    // limite global no banco: o mesmo erro vira no máximo 1 e-mail por hora, mesmo com várias instâncias
    const rl = await rateLimit(`err:${fingerprint}`, 1, 60 * 60).catch(() => ({ ok: true }));
    if (!rl.ok) return;

    const stack = (e.stack ?? "").split("\n").slice(0, 6).join("\n").slice(0, 1200);
    const subject = `[FechouClima] Erro em ${ctx.method} ${path}`.slice(0, 150);
    const text = `${e.name}: ${e.message.slice(0, 300)}\n${ctx.method} ${path} (${ctx.routeType ?? "?"})\n\n${stack}`;
    const html = `<p><strong>${escapeHtml(e.name)}</strong>: ${escapeHtml(e.message.slice(0, 300))}</p><p>${escapeHtml(ctx.method)} ${escapeHtml(path)} (${escapeHtml(ctx.routeType ?? "?")})</p><pre style="font-size:12px;white-space:pre-wrap">${escapeHtml(stack)}</pre>`;
    await sendEmail({ to, subject, html, text });
  } catch (inner) {
    console.error("[error-report] falhou", inner);
  }
}

// só para testes
export function _resetErrorReport() {
  seen.clear();
}
