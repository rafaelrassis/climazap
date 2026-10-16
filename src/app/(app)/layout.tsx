import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BottomNav } from "@/components/bottom-nav";
import { LogoutButton } from "@/components/logout-button";
import { SidebarNav } from "@/components/sidebar-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-dvh bg-background lg:flex">
      <SidebarNav userName={session.user.name ?? "Técnico"} />
      <div className="flex min-h-dvh flex-1 flex-col lg:min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-card lg:hidden">
          <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
            <Link href="/inicio" className="inline-flex min-h-11 items-center font-extrabold tracking-tight">
              FechouClima
            </Link>
            <LogoutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-lg flex-1 px-4 py-4 lg:max-w-6xl lg:px-10 lg:py-8">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
