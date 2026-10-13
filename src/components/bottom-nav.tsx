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
      <div aria-hidden className="h-[calc(4rem+env(safe-area-inset-bottom))]" />
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background pb-[env(safe-area-inset-bottom)]"
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
                    "flex h-16 flex-col items-center justify-center gap-1 text-xs",
                    active ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" />
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
