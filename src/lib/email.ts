// Envio via API REST do Resend (sem dependência). Sem RESEND_API_KEY, apenas ignora.
export async function sendEmail(opts: { to: string; subject: string; html: string; text: string; headers?: Record<string, string> }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, headers: opts.headers }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.error("[email] Resend respondeu", res.status);
    return res.ok;
  } catch (e) {
    console.error("[email] falha ao enviar", e);
    return false;
  }
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
