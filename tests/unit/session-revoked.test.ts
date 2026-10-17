import { describe, expect, it } from "vitest";
import { isSessionRevoked } from "@/lib/session-revoked";

describe("isSessionRevoked", () => {
  it("sem sessionsValidAfter, nunca revoga (mesmo sem issuedAt)", () => {
    expect(isSessionRevoked(undefined, null)).toBe(false);
    expect(isSessionRevoked(Date.now(), null)).toBe(false);
  });

  it("sem issuedAt (token antigo), vale como emitido em 0: revogado se houver validAfter", () => {
    expect(isSessionRevoked(undefined, new Date(1))).toBe(true);
  });

  it("issuedAt antes de validAfter: revogado", () => {
    const validAfter = new Date("2026-10-17T12:00:00Z");
    expect(isSessionRevoked(validAfter.getTime() - 1000, validAfter)).toBe(true);
  });

  it("issuedAt depois (ou igual) a validAfter: não revogado", () => {
    const validAfter = new Date("2026-10-17T12:00:00Z");
    expect(isSessionRevoked(validAfter.getTime() + 1000, validAfter)).toBe(false);
    expect(isSessionRevoked(validAfter.getTime(), validAfter)).toBe(false);
  });
});
