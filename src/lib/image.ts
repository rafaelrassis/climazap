export const MAX_PHOTO_BYTES = 450 * 1024;
export const MAX_PHOTOS_PER_QUOTE = 4;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const startsWith = (buf: Uint8Array, sig: number[]) => buf.length > sig.length + 8 && sig.every((b, i) => buf[i] === b);

// Detecta pelos bytes (não confia no tipo enviado). Só PNG e JPEG: SVG pode carregar script, WebP/GIF não são necessários.
export function detectPhotoType(buf: Uint8Array): "image/png" | "image/jpeg" | null {
  if (startsWith(buf, PNG)) return "image/png";
  if (startsWith(buf, JPEG)) return "image/jpeg";
  return null;
}
