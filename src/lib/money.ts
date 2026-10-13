export const formatBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

export const calcLineCents = (quantity: number, unitPriceCents: number) =>
  Math.round(quantity * unitPriceCents);
