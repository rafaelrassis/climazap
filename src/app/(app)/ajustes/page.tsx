import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-template";
import { WaTemplateForm } from "@/components/settings/wa-template-form";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const userId = await requireUserId();
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, companyName: true, waTemplate: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Ajustes</h1>
      <WaTemplateForm initial={user.waTemplate ?? DEFAULT_WA_TEMPLATE} sender={user.companyName ?? user.name} />
    </div>
  );
}
