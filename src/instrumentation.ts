// Chamado pelo Next em todo erro não tratado de renderização, rota ou server action.
// O import fica dentro do `if` do runtime: o bundle edge não pode enxergar módulos do Node (crypto, prisma).
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
  context: { routeType?: string; routePath?: string },
) {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { reportError } = await import("@/lib/error-report");
    await reportError(err, { path: request.path, method: request.method, routeType: context.routeType, routePath: context.routePath });
  }
}
