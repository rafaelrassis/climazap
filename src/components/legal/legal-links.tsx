import Link from "next/link";

export function LegalLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`flex justify-center gap-4 text-xs text-muted-foreground ${className}`}>
      <Link href="/termos" className="inline-flex min-h-11 items-center underline">
        Termos de uso
      </Link>
      <Link href="/privacidade" className="inline-flex min-h-11 items-center underline">
        Privacidade
      </Link>
    </p>
  );
}
