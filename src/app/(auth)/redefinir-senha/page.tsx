import { Suspense } from "react";
import { ResetForm } from "./reset-form";

export const metadata = { title: "Nova senha", robots: { index: false, follow: false } };

export default async function RedefinirSenhaPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token = "" } = await searchParams;
  return (
    <Suspense>
      <ResetForm token={token} />
    </Suspense>
  );
}
