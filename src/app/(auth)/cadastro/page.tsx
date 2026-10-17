import { Suspense } from "react";
import { CadastroForm } from "./cadastro-form";

export default async function CadastroPage({ searchParams }: { searchParams: Promise<{ ref?: string }> }) {
  const { ref = "" } = await searchParams;
  return (
    <Suspense>
      <CadastroForm refCode={ref} />
    </Suspense>
  );
}
