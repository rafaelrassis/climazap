import { describe, expect, it } from "vitest";
import { generateReferralCode } from "@/lib/referral";

describe("generateReferralCode", () => {
  it("gera 6 caracteres do alfabeto sem I/L/O/0/1", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateReferralCode();
      expect(code).toHaveLength(6);
      expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  it("gera códigos diferentes (não é sempre o mesmo)", () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateReferralCode()));
    expect(codes.size).toBeGreaterThan(1);
  });
});
