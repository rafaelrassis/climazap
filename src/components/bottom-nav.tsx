"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Home, Settings, Users, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/inicio", label: "Início", Icon: Home },
  { href: "/orcamentos", label: "Orçamentos", Icon: FileText },
  { href: "/clientes", label: "Clientes", Icon: Users },
  { href: "/servicos", label: "Serviços", Icon: Wrench },
  { href: "/ajustes", label: "Ajustes", Icon: Settings },
] as const;

// Escondida nas telas com barra de ações própria (formulário de orçamento)
const HIDDEN = /\/orcamentos\/(novo|[^/]+\/editar)$/;

export function BottomNav() {
  const pathname = usePathname();
  if (HIDDEN.test(pathname)) return null;

  return (
    <>
      <div aria-hidden className="h-[calc(76px+env(safe-area-inset-bottom))] lg:hidden" />
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ITEMS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-[76px] min-w-16 flex-col items-center justify-center gap-0.5 pb-2 text-[11px] font-semibold",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-7 w-12 items-center justify-center rounded-full",
                      active && "bg-info-bg",
                    )}
                  >
                    <Icon className="size-5" strokeWidth={2.2} />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
