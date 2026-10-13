import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { logoutAction } from "@/actions/auth";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="sticky top-0 z-20 border-b bg-background">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <Link href="/orcamentos" className="font-semibold">
            FechouClima
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/servicos" className="inline-flex min-h-11 items-center px-3 text-sm">
              Serviços
            </Link>
            <form action={logoutAction}>
              <Button variant="ghost" size="sm" type="submit" className="min-h-11">
                Sair
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-4">{children}</main>
    </div>
  );
}
