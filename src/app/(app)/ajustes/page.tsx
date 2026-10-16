import { db } from "@/lib/db";
import { requireUserId } from "@/lib/session";
import { DEFAULT_WA_TEMPLATE } from "@/lib/wa-template";
import { AccountSection } from "@/components/settings/account-section";
import { LegalLinks } from "@/components/legal/legal-links";
import { BrandColorForm } from "@/components/settings/brand-color-form";
import { brandOrDefault } from "@/lib/brand";
import { PixForm } from "@/components/settings/pix-form";
import { PushToggle } from "@/components/settings/push-toggle";
import { LogoForm } from "@/components/settings/logo-form";
import { EmailDigestToggle } from "@/components/settings/email-digest-toggle";
import { WaTemplateForm } from "@/components/settings/wa-template-form";
import { NudgeTemplateForm } from "@/components/settings/nudge-template-form";
import { DEFAULT_NUDGE_TEMPLATE } from "@/lib/followup";

export const metadata = { title: "Ajustes" };

export default async function AjustesPage() {
  const userId = await requireUserId();
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, companyName: true, waTemplate: true, nudgeTemplate: true, emailDigest: true, logoUpdatedAt: true, pixKey: true, pixKeyType: true, pixCity: true, brandColor: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Ajustes</h1>
      <LogoForm logoUrl={user.logoUpdatedAt ? `/api/logo?v=${user.logoUpdatedAt.getTime()}` : null} />
      <BrandColorForm initial={brandOrDefault(user.brandColor)} />
      <PixForm initialKey={user.pixKey ?? ""} initialType={user.pixKeyType ?? ""} initialCity={user.pixCity ?? ""} />
      <PushToggle />
      <EmailDigestToggle initial={user.emailDigest} />
      <WaTemplateForm initial={user.waTemplate ?? DEFAULT_WA_TEMPLATE} sender={user.companyName ?? user.name} />
      <NudgeTemplateForm initial={user.nudgeTemplate ?? DEFAULT_NUDGE_TEMPLATE} sender={user.companyName ?? user.name} />
      <AccountSection />
      <LegalLinks />
    </div>
  );
}
