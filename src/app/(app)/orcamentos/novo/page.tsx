import { listCustomers } from "@/actions/customers";
import { listServices } from "@/actions/services";
import { requireUserId } from "@/lib/session";
import { QuoteForm } from "@/components/quotes/quote-form";

export default async function NovoOrcamentoPage() {
  const userId = await requireUserId();
  const [services, customers] = await Promise.all([listServices(), listCustomers()]);
  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Novo orçamento</h1>
      <QuoteForm services={services} customers={customers} userId={userId} />
    </>
  );
}
