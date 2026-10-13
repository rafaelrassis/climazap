import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { addQuotePhoto, createQuote, removeQuotePhoto } from "@/actions/quotes";
import { GET as publicPhoto } from "@/app/o/[publicId]/foto/[photoId]/route";
import { GET as ownPhoto } from "@/app/api/fotos/[photoId]/route";
import { detectPhotoType } from "@/lib/image";
import { loginAs, makeUser, quoteInput, resetDb } from "../helpers/db";

beforeEach(resetDb);

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from("JFIF"), Buffer.alloc(40, 1)]);

const form = (bytes: Uint8Array | Buffer, type = "image/jpeg") => {
  const fd = new FormData();
  fd.set("photo", new File([new Uint8Array(bytes)], "f", { type }));
  return fd;
};
const pub = (publicId: string, photoId: string) => publicPhoto(new Request("http://x"), { params: Promise.resolve({ publicId, photoId }) });
const own = (photoId: string) => ownPhoto(new Request("http://x"), { params: Promise.resolve({ photoId }) });

async function quote(status: "DRAFT" | "SENT" | "APPROVED" = "DRAFT") {
  const q = await createQuote(quoteInput() as never);
  if (!q.ok) throw new Error(q.error);
  await db.quote.update({ where: { id: q.data.id }, data: { status } });
  return q.data;
}

describe("fotos do orçamento", () => {
  it("detecta o tipo pelos bytes: só JPEG e PNG", () => {
    expect(detectPhotoType(PNG)).toBe("image/png");
    expect(detectPhotoType(JPEG)).toBe("image/jpeg");
    expect(detectPhotoType(Buffer.from("<svg onload=alert(1)>............................"))).toBeNull();
    expect(detectPhotoType(Buffer.from("GIF89a" + "x".repeat(40)))).toBeNull();
  });

  it("aceita JPEG/PNG, recusa SVG disfarçado, vazio e arquivo grande", async () => {
    loginAs((await makeUser()).id);
    const q = await quote();
    expect((await addQuotePhoto(q.id, form(JPEG))).ok).toBe(true);
    expect((await addQuotePhoto(q.id, form(PNG, "image/png"))).ok).toBe(true);
    expect((await addQuotePhoto(q.id, form(Buffer.from("<svg onload=alert(1)></svg>" + " ".repeat(40))))).ok).toBe(false);
    expect((await addQuotePhoto(q.id, form(Buffer.alloc(0)))).ok).toBe(false);
    expect((await addQuotePhoto(q.id, form(Buffer.concat([JPEG, Buffer.alloc(500 * 1024)])))).ok).toBe(false);
    expect(await db.quotePhoto.count({ where: { quoteId: q.id } })).toBe(2);
  });

  it("limite de 4 fotos, inclusive com envios simultâneos", async () => {
    loginAs((await makeUser()).id);
    const q = await quote();
    const res = await Promise.all(Array.from({ length: 8 }, () => addQuotePhoto(q.id, form(JPEG))));
    expect(res.filter((r) => r.ok)).toHaveLength(4);
    expect(await db.quotePhoto.count({ where: { quoteId: q.id } })).toBe(4);
    const positions = (await db.quotePhoto.findMany({ where: { quoteId: q.id } })).map((p) => p.position).sort();
    expect(new Set(positions).size).toBe(4);
    expect((await addQuotePhoto(q.id, form(JPEG))).ok).toBe(false);
  });

  it("não vale para orçamento aprovado nem de outro técnico; remover idem", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const draft = await quote();
    const added = await addQuotePhoto(draft.id, form(JPEG));
    if (!added.ok) throw new Error(added.error);

    loginAs(b.id);
    expect((await addQuotePhoto(draft.id, form(JPEG))).ok).toBe(false);
    expect((await removeQuotePhoto(added.data.id)).ok).toBe(false);

    loginAs(a.id);
    const approved = await quote("APPROVED");
    expect((await addQuotePhoto(approved.id, form(JPEG))).ok).toBe(false);
    await db.quote.update({ where: { id: draft.id }, data: { status: "APPROVED" } });
    expect((await removeQuotePhoto(added.data.id)).ok).toBe(false); // aprovado: o que o cliente viu não muda
    await db.quote.update({ where: { id: draft.id }, data: { status: "SENT" } });
    expect((await removeQuotePhoto(added.data.id)).ok).toBe(true);
  });

  it("rota pública: só orçamento enviado, só a foto do próprio orçamento, com cabeçalhos seguros", async () => {
    loginAs((await makeUser()).id);
    const q1 = await quote("DRAFT");
    const q2 = await quote("SENT");
    const p1 = await addQuotePhoto(q1.id, form(JPEG));
    const p2 = await addQuotePhoto(q2.id, form(PNG, "image/png"));
    if (!p1.ok || !p2.ok) throw new Error("upload");

    expect((await pub(q1.publicId, p1.data.id)).status).toBe(404); // rascunho não expõe
    const ok = await pub(q2.publicId, p2.data.id);
    expect(ok.status).toBe(200);
    expect(ok.headers.get("content-type")).toBe("image/png");
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await ok.arrayBuffer()).equals(PNG)).toBe(true);

    expect((await pub(q2.publicId, p1.data.id)).status).toBe(404); // foto de outro orçamento
    expect((await pub("nao-uuid", p2.data.id)).status).toBe(404);
    expect((await pub(q2.publicId, "../../etc/passwd")).status).toBe(404);
    await db.quote.update({ where: { id: q1.id }, data: { status: "SENT" } });
    expect((await pub(q1.publicId, p1.data.id)).status).toBe(200); // depois de enviado, aparece
  });

  it("rota do técnico exige login e só entrega fotos dele (inclusive de rascunho)", async () => {
    const a = await makeUser();
    const b = await makeUser();
    loginAs(a.id);
    const q = await quote("DRAFT");
    const p = await addQuotePhoto(q.id, form(JPEG));
    if (!p.ok) throw new Error("upload");
    expect((await own(p.data.id)).status).toBe(200);
    loginAs(b.id);
    expect((await own(p.data.id)).status).toBe(404);
    loginAs("");
    expect((await own(p.data.id)).status).toBe(401);
  });

  it("apagar o orçamento ou a conta leva as fotos junto", async () => {
    const u = await makeUser();
    loginAs(u.id);
    const q = await quote();
    await addQuotePhoto(q.id, form(JPEG));
    await db.quote.delete({ where: { id: q.id } });
    expect(await db.quotePhoto.count()).toBe(0);
    const q2 = await quote();
    await addQuotePhoto(q2.id, form(JPEG));
    await db.user.delete({ where: { id: u.id } });
    expect(await db.quotePhoto.count()).toBe(0);
  });
});
