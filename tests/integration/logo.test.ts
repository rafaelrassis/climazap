import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createQuote } from "@/actions/quotes";
import { removeLogo, saveLogo } from "@/actions/settings";
import { GET as publicLogo } from "@/app/o/[publicId]/logo/route";
import { detectLogoType, pngSize } from "@/lib/logo";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

beforeEach(resetDb);

// PNG 1x1 válido
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const form = (bytes: Uint8Array | Buffer, name = "logo.png", type = "image/png") => {
  const fd = new FormData();
  fd.set("logo", new File([new Uint8Array(bytes)], name, { type }));
  return fd;
};

describe("logo do técnico", () => {
  it("detecta o tipo pelos bytes, não pelo nome", () => {
    expect(detectLogoType(PNG_1X1)).toBe("image/png");
    expect(detectLogoType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...new Array(30).fill(0)]))).toBeNull(); // JPEG não é aceito
    expect(pngSize(PNG_1X1)).toEqual({ width: 1, height: 1 });
    expect(pngSize(Buffer.from("lixo"))).toBeNull();
    expect(detectLogoType(Buffer.from("<svg onload=alert(1)></svg>"))).toBeNull();
    expect(detectLogoType(Buffer.from("GIF89a"))).toBeNull();
  });

  it("rejeita SVG disfarçado de PNG, arquivo grande e vazio", async () => {
    loginAs((await makeUser()).id);
    expect((await saveLogo(form(Buffer.from("<svg></svg>")))).ok).toBe(false);
    expect((await saveLogo(form(Buffer.concat([PNG_1X1, Buffer.alloc(200 * 1024)])))).ok).toBe(false);
    expect((await saveLogo(form(Buffer.alloc(0)))).ok).toBe(false);
  });

  it("salva, serve pelo publicId e remove", async () => {
    const u = await makeUser();
    loginAs(u.id);
    expect((await saveLogo(form(PNG_1X1))).ok).toBe(true);

    const q = await createQuote(quoteInput() as never);
    if (!q.ok) throw new Error(q.error);

    const res = await publicLogo(new Request("http://x"), { params: { publicId: q.data.publicId } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG_1X1)).toBe(true);

    expect((await removeLogo()).ok).toBe(true);
    const gone = await publicLogo(new Request("http://x"), { params: { publicId: q.data.publicId } });
    expect(gone.status).toBe(404);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).logo).toBeNull();
  });

  it("publicId inválido ou inexistente dá 404 e não vaza a logo de outro técnico", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    await saveLogo(form(PNG_1X1));
    loginAs(b.id);
    const qb = await createQuote(quoteInput() as never);
    if (!qb.ok) throw new Error(qb.error);
    expect((await publicLogo(new Request("http://x"), { params: { publicId: qb.data.publicId } })).status).toBe(404);
    expect((await publicLogo(new Request("http://x"), { params: { publicId: "não-uuid" } })).status).toBe(404);
  });
});
