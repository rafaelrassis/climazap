// Tokens antigos sem `issuedAt` valem como emitidos em 0: só são revogados se houver `sessionsValidAfter`.
export function isSessionRevoked(issuedAt: number | undefined, validAfter: Date | null): boolean {
  if (!validAfter) return false;
  return (issuedAt ?? 0) < validAfter.getTime();
}
