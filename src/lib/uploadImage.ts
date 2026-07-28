/**
 * 이미지 업로드 유틸 — expo-image-picker의 base64를 Storage에 올리고 public URL을 돌려준다.
 * avatars/covers 등 버킷 공용. RN에 atob가 없을 수 있어 base64를 직접 디코드한다.
 */
import { supabase } from './supabase';

export async function uploadImageBase64(
  bucket: string,
  path: string,
  base64: string,
  contentType = 'image/jpeg',
): Promise<string> {
  const bytes = base64ToBytes(base64);
  const { error } = await supabase.storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const len = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64.indexOf(clean[i]);
    const b = B64.indexOf(clean[i + 1]);
    const c = B64.indexOf(clean[i + 2]);
    const d = B64.indexOf(clean[i + 3]);
    out[p++] = (a << 2) | (b >> 4);
    if (c !== -1 && i + 2 < clean.length) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (d !== -1 && i + 3 < clean.length) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}
