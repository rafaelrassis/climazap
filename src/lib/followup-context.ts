import { db } from "@/lib/db";
import type { FollowUpContext } from "@/lib/followup";

export async function getFollowUpContext(userId: string): Promise<FollowUpContext> {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, companyName: true, nudgeTemplate: true },
  });
  return {
    template: user.nudgeTemplate,
    tecnico: user.companyName ?? user.name,
    baseUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  };
}
