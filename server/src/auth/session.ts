/** Short signed session tokens: base64url(json).base64url(hmac). The app keeps one and sends it on every call. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export type Session = { uid: string; name: string; exp: number };

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function signSession(s: Omit<Session, 'exp'>, secret: string, ttlSec = 7 * 24 * 3600): string {
  const body = b64(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const mac = b64(createHmac('sha256', secret).update(body).digest());
  return `${body}.${mac}`;
}

export function verifySession(token: string | null | undefined, secret: string): Session | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(mac, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as Session;
  return s.exp > Date.now() / 1000 ? s : null;
}
