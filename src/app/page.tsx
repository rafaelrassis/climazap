import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Clock, FileText, MessageCircle, Shield, Snowflake, TrendingUp } from "lucide-react";
import { auth } from "@/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "FechouClima — Orçamento pronto em 60 segundos, direto no WhatsApp",
  description:
    "Monte o orçamento no celular, envie o link ao cliente e receba a aprovação com 1 toque. Feito para técnicos de ar-condicionado e refrigeração.",
  openGraph: {
    title: "FechouClima — Orçamento pronto em 60 segundos",
    description: "Monte no celular, envie pelo WhatsApp e o cliente aprova com 1 toque, sem login.",
    type: "website",
    locale: "pt_BR",
  },
};

const STEPS = [
  {
    n: 1,
    title: "Monte no celular",
    text: "Escolha os serviços do seu catálogo, ajuste quantidade e desconto e adicione fotos.",
  },
  {
    n: 2,
    title: "Envie pelo WhatsApp",
    text: "Um toque abre a conversa com a mensagem pronta e o link do orçamento com a sua marca.",
  },
  {
    n: 3,
    title: "Cliente aprova com 1 toque",
    text: "Você recebe o aviso no celular, e o cliente ainda pode pagar por Pix depois de aprovar.",
  },
] as const;

const BENEFITS = [
  {
    Icon: MessageCircle,
    tone: "success" as const,
    title: "Cobrança de quem não respondeu",
    text: "Veja quem está há mais de 2 dias sem resposta e chame com um toque.",
  },
  {
    Icon: FileText,
    tone: "info" as const,
    title: "PDF e sua marca",
    text: "Logo e cor próprias no link público e no PDF do orçamento.",
  },
  {
    Icon: Clock,
    tone: "warning" as const,
    title: "Lembrete de manutenção",
    text: "Reabordar o cliente em 3, 6 ou 12 meses para vender o próximo serviço.",
  },
  {
    Icon: TrendingUp,
    tone: "info" as const,
    title: "Painel do mês",
    text: "Quanto está aguardando, aprovado e a receber, e a sua taxa de aprovação.",
  },
  {
    Icon: CheckCircle2,
    tone: "success" as const,
    title: "Pix depois da aprovação",
    text: "QR Code e copia e cola prontos assim que o cliente aprova.",
  },
  {
    Icon: Shield,
    tone: "error" as const,
    title: "Seus dados protegidos",
    text: "Telefone e endereço do cliente nunca aparecem no link. Exporte ou exclua tudo quando quiser (LGPD).",
  },
] as const;

const TONE_STYLE = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  info: "bg-info-bg text-primary",
  error: "bg-error-bg text-error",
} as const;

export default async function LandingOrHome() {
  const session = await auth();
  if (session?.user) redirect("/inicio");

  return (
    <div className="flex flex-col bg-background">
      <header className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-3 px-5 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-white">
            <Snowflake className="size-[22px]" strokeWidth={2.2} />
          </span>
          <span className="text-[20px] font-extrabold tracking-tight">FechouClima</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="inline-flex h-11 items-center rounded-xl px-4 text-sm font-bold text-primary">
            Entrar
          </Link>
          <Button asChild className="h-11 px-5">
            <Link href="/cadastro">Criar conta</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center gap-10 px-5 py-8 lg:gap-12 lg:px-8 lg:py-14">
        <div className="flex min-w-0 flex-1 basis-[420px] flex-col gap-5">
          <span className="w-fit rounded-full bg-info-bg px-3 py-1.5 text-[13px] font-bold text-primary">
            Para técnicos de ar-condicionado e refrigeração
          </span>
          <h1 className="text-balance text-[34px] font-extrabold leading-[1.1] tracking-tight lg:text-[52px]">
            Orçamento pronto em 60 segundos, direto no WhatsApp.
          </h1>
          <p className="max-w-[520px] text-[17px] leading-relaxed text-muted-foreground lg:text-lg">
            Monte o orçamento no celular, envie o link ao cliente e receba a aprovação com 1 toque. Sem planilha, sem
            papel, sem o cliente precisar de login.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Button asChild className="h-[54px] px-7 text-base shadow-[0_8px_16px_rgba(14,116,144,0.3)]">
              <Link href="/cadastro">Criar minha conta</Link>
            </Button>
            <Button asChild variant="outline" className="h-[54px] px-6 text-base">
              <Link href="#como">Ver como funciona</Link>
            </Button>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 basis-[320px] justify-center">
          <div className="flex w-[300px] flex-col gap-3.5 rounded-[32px] border-[6px] border-primary-dark bg-card p-5 shadow-[0_24px_48px_rgba(11,58,74,0.18)]">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary-dark text-[12px] font-extrabold text-white">
                CS
              </span>
              <div className="flex flex-col">
                <span className="text-[13px] font-extrabold">Carlos Refrigeração</span>
                <span className="text-[11px] font-semibold text-muted-foreground">Orçamento #132</span>
              </div>
            </div>
            <div className="flex flex-col gap-2 text-[13px] font-semibold">
              <div className="flex justify-between">
                <span>Instalação split 12.000 BTUs</span>
                <span className="tabular-nums">R$ 650,00</span>
              </div>
              <div className="flex justify-between">
                <span>Limpeza completa</span>
                <span className="tabular-nums">R$ 180,00</span>
              </div>
              <div className="flex justify-between">
                <span>Suporte e tubulação</span>
                <span className="tabular-nums">R$ 220,00</span>
              </div>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold text-muted-foreground">Total</span>
              <span className="text-2xl font-extrabold tabular-nums">R$ 1.050,00</span>
            </div>
            <div className="flex gap-2">
              <span className="flex h-11 flex-1 items-center justify-center rounded-xl bg-success text-sm font-bold text-white">
                Aprovar
              </span>
              <span className="flex h-11 items-center justify-center rounded-xl bg-background px-4 text-sm font-bold text-muted-foreground">
                Recusar
              </span>
            </div>
          </div>
        </div>
      </section>

      <section id="como" className="bg-card px-5 py-14 lg:px-8 lg:py-[72px]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 lg:gap-10">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-bold text-primary">Como funciona</span>
            <h2 className="text-[28px] font-extrabold tracking-tight lg:text-[36px]">Do orçamento ao sim, em três passos.</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="flex flex-col gap-3 rounded-3xl bg-background p-6">
                <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-lg font-extrabold text-white">
                  {s.n}
                </span>
                <span className="text-lg font-extrabold">{s.title}</span>
                <span className="text-[15px] leading-relaxed text-muted-foreground">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-14 lg:px-8 lg:py-[72px]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 lg:gap-10">
          <h2 className="text-[28px] font-extrabold tracking-tight lg:text-[36px]">Tudo para fechar mais serviços.</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ Icon, tone, title, text }) => (
              <div key={title} className="flex gap-3.5 rounded-[20px] bg-card p-5 shadow-[0_1px_2px_rgba(11,37,48,0.06)]">
                <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", TONE_STYLE[tone])}>
                  <Icon className="size-5" strokeWidth={2.3} />
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-base font-extrabold">{title}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-14 lg:px-8 lg:pb-[72px]">
        <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center gap-5 rounded-[32px] bg-brand px-6 py-14 text-center text-white lg:px-8">
          <h2 className="text-balance text-[28px] font-extrabold tracking-tight lg:text-[36px]">
            Seu próximo orçamento pode sair em 60 segundos.
          </h2>
          <span className="max-w-[520px] text-base leading-relaxed text-white/85 lg:text-[17px]">
            Crie sua conta e envie o primeiro orçamento hoje.
          </span>
          <Button asChild className="h-[54px] bg-white px-8 text-base text-primary-dark hover:bg-white/90">
            <Link href="/cadastro">Criar minha conta</Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 pb-10 text-[13px] text-muted-foreground lg:px-8">
        <span>© FechouClima · fechouclima.com.br</span>
        <div className="flex gap-5 font-semibold">
          <Link href="/termos" className="inline-flex min-h-11 items-center">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="inline-flex min-h-11 items-center">
            Política de Privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
