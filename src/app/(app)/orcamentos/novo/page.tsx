import { listCustomers } from "@/actions/customers";
import { listServices } from "@/actions/services";
import { requireUserId } from "@/lib/session";
import { QuoteForm } from "@/components/quotes/quote-form";

export default async function NovoOrcamentoPage({ searchParams }: { searchParams: { cliente?: string } }) {
  const userId = await requireUserId();
  const [services, customers] = await Promise.all([listServices(), listCustomers()]);
  const prefill = searchParams.cliente ? customers.find((c) => c.id === searchParams.cliente) : undefined;

  return (
    <>
      <h1 className="mb-4 text-lg font-semibold">Novo orçamento</h1>
      <QuoteForm services={services} customers={customers}
        userId={userId}
        prefill={prefill ? { name: prefill.name, phone: prefill.phone, address: prefill.address ?? "" } : undefined}
      />
    </>
  );
}
