import { listServices } from "@/actions/services";
import { QuoteForm } from "@/components/quotes/quote-form";

export default async function NovoOrcamentoPage() {
  const services = await listServices();
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Novo orçamento</h1>
      <QuoteForm services={services} />
    </>
  );
}
