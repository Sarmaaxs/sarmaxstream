// Saves real files on the phone (Android app only): music goes to Music/Sarmaxstream,
// books and other files to Download/Sarmaxstream. Needs the new app build (window.SxNative.beginFile).
import { isNative } from '@/lib/native';

export const canSaveToPhone = () =>
  isNative && typeof window !== 'undefined' && !!window.SxNative && typeof window.SxNative.beginFile === 'function';

const CHUNK = 384 * 1024;

async function chunkToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  return btoa(bin);
}

// returns the folder name it was saved in, or null
export async function saveBlobToPhone(blob, filename, kind = 'music') {
  if (!canSaveToPhone()) return null;
  const n = window.SxNative;
  const mime = blob.type || (kind === 'music' ? 'audio/mpeg' : 'application/octet-stream');
  let id = -1;
  try { id = n.beginFile(filename, mime, kind); } catch { return null; }
  if (id < 0) return null;
  let ok = true;
  try {
    for (let off = 0; off < blob.size; off += CHUNK) {
      const part = await chunkToBase64(blob.slice(off, off + CHUNK));
      if (!n.appendFile(id, part)) { ok = false; break; }
    }
  } catch { ok = false; }
  let where = '';
  try { where = n.endFile(id, ok); } catch { where = ''; }
  return ok && where ? where : null;
}

export function saveTextToPhone(text, filename) {
  return saveBlobToPhone(new Blob([text], { type: 'text/plain' }), filename, 'document');
}
