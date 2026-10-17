import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, Clock, Plus, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { expireStaleQuotes } from "@/lib/quote-expiry";
import { requireUserId } from "@/lib/session";
import { formatBRL } from "@/lib/money";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { canSnooze, expiryLabel, followUpMessage, viewedLabel } from "@/lib/followup";
import { renderMaintenanceMessage } from "@/lib/maintenance";
import { followUpWhere } from "@/lib/followup-queries";
import { getFollowUpContext } from "@/lib/followup-context";
import { getNudgeFunnel } from "@/lib/nudge-funnel";
import { cn, getInitials } from "@/lib/utils";
import { CompleteReminderButton } from "@/components/quotes/complete-reminder-button";
import { NudgeButton } from "@/components/quotes/nudge-button";
import { SnoozeButton } from "@/components/quotes/snooze-button";
import { StatusBadge } from "@/components/quotes/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Início" };

const BR_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo = UTC-3 (sem horário de verão)
const DAY_MS = 24 * 60 * 60 * 1000;

function monthStartBR(now: Date) {
  const br = new Date(now.getTime() - BR_OFFSET_MS);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), 1) + BR_OFFSET_MS);
}

function greetingBR(now: Date) {
  const hour = new Date(now.getTime() - BR_OFFSET_MS).getUTCHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function daysAgo(date: Date, now: Date) {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / DAY_MS));
}

const TONE_STYLE = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-info",
} as const;

function Stat({ icon, tone, label, value, href }: { icon: ReactNode; tone: keyof typeof TONE_STYLE; label: string; value: string; href: string }) {
  return (
    <Link href={href} className="block h-full">
      <Card className="h-full">
        <CardContent className="flex flex-col gap-1.5 px-2.5 py-3.5 lg:gap-2 lg:px-5 lg:py-5">
          <span className={cn("flex size-8 items-center justify-center rounded-[10px] lg:size-9", TONE_STYLE[tone])}>
            {icon}
          </span>
          <span className="text-[11px] font-semibold text-muted-foreground lg:text-[13px]">{label}</span>
          <span className="truncate text-[15px] font-extrabold tabular-nums leading-tight lg:text-2xl">{value}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

const fmtMonth = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default async function InicioPage() {
  const [session, userId] = await Promise.all([auth(), requireUserId()]);
  await expireStaleQuotes(userId);

  const now = new Date();
  const monthStart = monthStartBR(now);
  const since30 = new Date(now.getTime() - 30 * DAY_MS);

  const [pending, approvedMonth, receivable, answered30, approved30, stale, due, recent, funnel, followUpCtx] = await Promise.all([
    db.quote.aggregate({ where: { userId, status: "SENT" }, _count: true, _sum: { totalCents: true } }),
    db.quote.aggregate({
      where: { userId, status: "APPROVED", respondedAt: { gte: monthStart } },
      _count: true,
      _sum: { totalCents: true },
    }),
    db.quote.aggregate({
      where: { userId, status: "APPROVED", paidAt: null },
      _count: true,
      _sum: { totalCents: true },
    }),
    db.quote.count({ where: { userId, sentAt: { gte: since30 }, status: { in: ["APPROVED", "REJECTED", "EXPIRED"] } } }),
    db.quote.count({ where: { userId, sentAt: { gte: since30 }, status: "APPROVED" } }),
    db.quote.findMany({
      where: { userId, ...followUpWhere(now) },
      orderBy: [{ validUntil: "asc" }, { sentAt: "asc" }],
      take: 5,
      select: {
        id: true,
        number: true,
        customerName: true,
        customerPhone: true,
        totalCents: true,
        sentAt: true,
        validUntil: true,
        publicId: true,
        lastNudgeAt: true,
        viewedAt: true,
      },
    }),
    db.quote.findMany({
      where: { userId, reminderAt: { lte: now }, reminderDoneAt: null },
      orderBy: { reminderAt: "asc" },
      take: 5,
      select: { id: true, customerName: true, customerPhone: true, respondedAt: true, reminderText: true, reminderService: true },
    }),
    db.quote.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, number: true, customerName: true, status: true, totalCents: true },
    }),
    getNudgeFunnel(userId, now),
    getFollowUpContext(userId),
  ]);

  const rate = answered30 > 0 ? Math.round((approved30 / answered30) * 100) : null;
  const userName = session?.user?.name ?? "Técnico";
  const firstName = userName.split(" ")[0];

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-muted-foreground">
            {greetingBR(now)}, {firstName}
          </span>
          <h1 className="text-[22px] font-extrabold tracking-tight lg:text-[28px]">Seu painel</h1>
        </div>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-primary-foreground lg:hidden">
          {getInitials(userName)}
        </span>
        <Button asChild className="hidden h-12 shadow-[0_8px_16px_rgba(14,116,144,0.3)] lg:inline-flex">
          <Link href="/orcamentos/novo">
            <Plus />
            Novo orçamento
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-3xl bg-brand p-5 text-white shadow-[0_12px_24px_rgba(14,116,144,0.25)]">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-semibold opacity-85">Aguardando resposta</span>
          <span className="rounded-full bg-white/[0.18] px-2.5 py-1 text-xs font-bold">
            {plural(pending._count, "orçamento", "orçamentos")}
          </span>
        </div>
        <span className="text-[34px] font-extrabold tracking-tight tabular-nums lg:text-4xl">
          {formatBRL(pending._sum.totalCents ?? 0)}
        </span>
        <Button asChild className="h-12 bg-white text-primary-dark hover:bg-white/90 lg:hidden">
          <Link href="/orcamentos/novo">
            <Plus />
            Novo orçamento
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2.5 lg:gap-4">
        <Stat
          icon={<CheckCircle2 className="size-[18px]" strokeWidth={2.4} />}
          tone="success"
          label="Aprovado no mês"
          value={formatBRL(approvedMonth._sum.totalCents ?? 0)}
          href="/orcamentos"
        />
        <Stat
          icon={<Clock className="size-[18px]" strokeWidth={2.4} />}
          tone="warning"
          label="A receber"
          value={formatBRL(receivable._sum.totalCents ?? 0)}
          href="/orcamentos"
        />
        <Stat
          icon={<TrendingUp className="size-[18px]" strokeWidth={2.4} />}
          tone="info"
          label="Taxa de aprovação"
          value={rate === null ? "—" : `${rate}%`}
          href="/orcamentos"
        />
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-4 lg:order-2 lg:w-[320px] lg:flex-none">
          {due.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[15px] font-bold">Hora da manutenção</h2>
              {due.map((q) => (
                <Card key={q.id}>
                  <CardContent className="flex flex-col gap-2 p-3">
                    <div className="flex items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-bg text-xs font-extrabold text-success">
                        {getInitials(q.customerName)}
                      </span>
                      <Link href={`/orcamentos/${q.id}`} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                        <span className="truncate text-sm font-bold">{q.customerName}</span>
                        <span className="text-[13px] font-semibold text-muted-foreground">
                          serviço de {q.respondedAt ? fmtMonth.format(q.respondedAt) : "—"}
                          {q.reminderService && ` · ${q.reminderService}`}
                        </span>
                      </Link>
                      <Button asChild className="h-11 shrink-0 px-4">
                        <a
                          href={buildWhatsAppUrl(
                            q.customerPhone,
                            renderMaintenanceMessage(
                              { cliente: q.customerName, tecnico: followUpCtx.tecnico, servico: q.reminderService ?? "manutenção preventiva" },
                              q.reminderText,
                            ),
                          )}
                        >
                          Chamar
                        </a>
                      </Button>
                    </div>
                    <div className="flex justify-end">
                      <CompleteReminderButton quoteId={q.id} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {stale.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-[15px] font-bold">Sem resposta ou vencendo</h2>
              {stale.map((q) => (
                <Card key={q.id}>
                  <CardContent className="flex flex-col gap-1 p-3">
                    <div className="flex items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-bg text-xs font-extrabold text-info">
                      {getInitials(q.customerName)}
                    </span>
                    <Link href={`/orcamentos/${q.id}`} className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                      <span className="truncate text-sm font-bold">
                        #{q.number} · {q.customerName}
                      </span>
                      <span className="truncate text-[13px] font-semibold text-muted-foreground tabular-nums">
                        {formatBRL(q.totalCents)} · há {plural(daysAgo(q.sentAt ?? now, now), "dia", "dias")}
                        {expiryLabel(q.validUntil, now) && (
                          <span className="font-bold text-warning"> · {expiryLabel(q.validUntil, now)}</span>
                        )}
                        {viewedLabel(q.viewedAt, "SENT") && <span> · {viewedLabel(q.viewedAt, "SENT")}</span>}
                      </span>
                    </Link>
                    <NudgeButton quoteId={q.id} href={buildWhatsAppUrl(q.customerPhone, followUpMessage(q, now, followUpCtx))} nudged={!!q.lastNudgeAt} />
                    </div>
                    {canSnooze(q.validUntil, now) && (
                      <div className="flex justify-end">
                        <SnoozeButton quoteId={q.id} />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          {funnel.nudged > 0 && (
            <Card>
              <CardContent className="space-y-1 p-3">
                <h2 className="text-[15px] font-bold">Cobranças nos últimos 30 dias</h2>
                <p className="text-[13px] font-semibold text-muted-foreground tabular-nums">
                  {plural(funnel.nudged, "cobrado", "cobrados")} · {funnel.approvedAfter} aprovaram depois
                  {funnel.approvedAfter > 0 && ` (${formatBRL(funnel.approvedCents)})`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {recent.length > 0 && (
          <section className="hidden flex-1 flex-col gap-3 rounded-3xl bg-card p-5 shadow-[0_1px_2px_rgba(11,37,48,0.06)] lg:order-1 lg:flex">
            <div className="flex items-center justify-between">
              <span className="text-base font-extrabold">Orçamentos recentes</span>
              <Link href="/orcamentos" className="text-[13px] font-bold text-primary">
                Ver todos
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-bold text-muted-foreground">
                    <th className="px-2 py-2">Nº</th>
                    <th className="px-2 py-2">Cliente</th>
                    <th className="px-2 py-2">Valor</th>
                    <th className="px-2 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="font-semibold">
                  {recent.map((q) => (
                    <tr key={q.id} className="border-b border-[#eef3f5] last:border-0">
                      <td className="px-2 py-3.5 text-muted-foreground">#{q.number}</td>
                      <td className="px-2 py-3.5">
                        <Link href={`/orcamentos/${q.id}`} className="inline-flex min-h-11 items-center">
                          {q.customerName}
                        </Link>
                      </td>
                      <td className="px-2 py-3.5 tabular-nums">{formatBRL(q.totalCents)}</td>
                      <td className="px-2 py-3.5">
                        <StatusBadge status={q.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
