"use client";

import { formatBRL } from "@/lib/money";
import { Input } from "@/components/ui/input";

const MAX_CENTS = 100_000_00;

export function MoneyInput({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (cents: number) => void;
  label: string;
}) {
  return (
    <Input
      aria-label={label}
      inputMode="numeric"
      className="h-11 text-base"
      value={formatBRL(value)}
      onChange={(e) => onChange(Math.min(Number(e.target.value.replace(/\D/g, "")) || 0, MAX_CENTS))}
    />
  );
}
