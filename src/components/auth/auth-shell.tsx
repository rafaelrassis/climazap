import type { ReactNode } from "react";
import Link from "next/link";
import { Snowflake } from "lucide-react";

const BADGES = ["Link público", "PDF e Pix", "Aviso de aprovação"];

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      <section className="flex flex-col gap-4 rounded-b-[32px] bg-brand px-6 pb-16 pt-12 text-white lg:flex-1 lg:justify-between lg:gap-12 lg:rounded-none lg:px-16 lg:py-16">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary lg:size-12">
            <Snowflake className="size-[26px] lg:size-7" strokeWidth={2.2} />
          </span>
          <span className="text-[22px] font-extrabold tracking-tight lg:text-2xl">FechouClima</span>
        </Link>
        <div className="flex flex-col gap-2 lg:max-w-[520px] lg:gap-5">
          <h1 className="text-balance text-[28px] font-extrabold leading-[1.15] tracking-tight lg:text-[44px] lg:leading-[1.1]">
            Orçamento pronto em 60 segundos.
          </h1>
          <p className="text-[15px] leading-snug text-white/85 lg:text-lg lg:leading-relaxed">
            Monte no celular, envie pelo WhatsApp e o cliente aprova com 1 toque, sem login.
          </p>
          <div className="hidden flex-wrap gap-2.5 lg:flex">
            {BADGES.map((b) => (
              <span key={b} className="rounded-full bg-white/[0.16] px-3.5 py-2 text-[13px] font-bold">
                {b}
              </span>
            ))}
          </div>
        </div>
        <span className="hidden text-[13px] text-white/70 lg:block">Feito para técnicos de ar-condicionado e refrigeração.</span>
      </section>

      <section className="flex flex-1 flex-col items-center px-4 pb-6 lg:justify-center lg:px-10 lg:py-10">
        <div className="-mt-10 flex w-full max-w-sm flex-col gap-4 rounded-3xl bg-card p-6 shadow-[0_12px_32px_rgba(11,58,74,0.12)] lg:mt-0 lg:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-extrabold tracking-tight lg:text-2xl">{title}</h2>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {children}
        </div>
        {footer}
      </section>
    </main>
  );
}
