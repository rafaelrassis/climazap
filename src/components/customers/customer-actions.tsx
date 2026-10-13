"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteCustomer, updateCustomer } from "@/actions/customers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function CustomerActions({ id, name, address }: { id: string; name: string; address: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [nameValue, setNameValue] = useState(name);
  const [addressValue, setAddressValue] = useState(address);

  function save() {
    startTransition(async () => {
      const res = await updateCustomer({ id, name: nameValue, address: addressValue });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Cliente atualizado");
      setEditOpen(false);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const res = await deleteCustomer(id);
      if (!res.ok) {
        toast.error(res.error);
        setDeleteOpen(false);
        return;
      }
      toast.success("Cliente excluído");
      router.push("/clientes");
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" className="h-11">
            Editar cliente
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-xl pb-[max(1rem,env(safe-area-inset-bottom))]">
          <SheetHeader className="text-left">
            <SheetTitle>Editar cliente</SheetTitle>
            <SheetDescription>O telefone identifica o cliente e não muda. Orçamentos antigos mantêm os dados originais.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cust-name">Nome</Label>
              <Input id="cust-name" className="h-12 text-base" value={nameValue} maxLength={120} onChange={(e) => setNameValue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cust-address">Endereço</Label>
              <Input id="cust-address" className="h-12 text-base" value={addressValue} maxLength={300} onChange={(e) => setAddressValue(e.target.value)} />
            </div>
            <Button className="h-12 w-full text-base" disabled={pending || nameValue.trim().length < 2} onClick={save}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" className="h-11 text-muted-foreground">
            Excluir cliente
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {name}?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente sai da sua lista e do autocomplete. Os orçamentos dele continuam existindo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="h-12" disabled={pending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              className="h-12"
              disabled={pending}
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
            >
              {pending ? "Excluindo..." : "Sim, excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
