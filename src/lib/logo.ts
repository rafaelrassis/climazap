export const MAX_LOGO_BYTES = 150 * 1024;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Só PNG, detectado pelos bytes (não confia no nome/tipo enviado). O navegador sempre converte para PNG
// antes de enviar. SVG fica de fora (pode carregar script) e JPEG/WebP também (dimensões e OG image).
export function detectLogoType(buf: Uint8Array): "image/png" | null {
  return buf.length >= 24 && PNG.every((b, i) => buf[i] === b) ? "image/png" : null;
}

// Largura/altura lidas do cabeçalho IHDR do PNG (bytes 16-23, big-endian)
export function pngSize(buf: Uint8Array): { width: number; height: number } | null {
  if (!detectLogoType(buf)) return null;
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}
