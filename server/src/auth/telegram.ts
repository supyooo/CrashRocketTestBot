/**
 * Telegram Mini App login.
 *
 * The app sends Telegram.WebApp.initData as is. Telegram signed it with a key derived from the bot token,
 * so only Telegram (and we, holding the token) can produce a valid hash: the user id inside cannot be faked.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type TgUser = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string; photo_url?: string };
export type InitData = { user: TgUser; authDate: number; startParam?: string };

export class AuthError extends Error {}

export function validateInitData(initData: string, botToken: string, maxAgeSec = 24 * 3600, now = Date.now()): InitData {
  if (!botToken) throw new AuthError('bot token is not configured');
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) throw new AuthError('hash is missing');
  params.delete('hash');
  const dataCheck = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheck).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AuthError('bad signature');
  const authDate = Number(params.get('auth_date'));
  if (!authDate || now / 1000 - authDate > maxAgeSec) throw new AuthError('init data expired');
  const userRaw = params.get('user');
  if (!userRaw) throw new AuthError('user is missing');
  const user = JSON.parse(userRaw) as TgUser;
  return { user, authDate, startParam: params.get('start_param') ?? undefined };
}

/**
 * Telegram Login Widget (the admin panel's "Log in with Telegram" on an ordinary website). The secret here is
 * SHA-256 of the bot token, not the WebAppData HMAC of the Mini App.
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function validateLoginWidget(data: Record<string, unknown>, botToken: string, maxAgeSec = 24 * 3600, now = Date.now()): TgUser {
  if (!botToken) throw new AuthError('bot token is not configured');
  const hash = typeof data.hash === 'string' ? data.hash : '';
  if (!hash) throw new AuthError('hash is missing');
  const dataCheck = Object.entries(data).filter(([k, v]) => k !== 'hash' && v !== undefined && v !== null).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheck).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new AuthError('bad signature');
  const authDate = Number(data.auth_date);
  if (!authDate || now / 1000 - authDate > maxAgeSec) throw new AuthError('login expired');
  return { id: Number(data.id), first_name: data.first_name as string | undefined, last_name: data.last_name as string | undefined, username: data.username as string | undefined, photo_url: data.photo_url as string | undefined };
}

/** Signs login widget data the way Telegram does; used by tests. */
export function signLoginWidget(fields: Record<string, string>, botToken: string): Record<string, string> {
  const dataCheck = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const hash = createHmac('sha256', createHash('sha256').update(botToken).digest()).update(dataCheck).digest('hex');
  return { ...fields, hash };
}

/** Builds signed init data the way Telegram does; used by tests. */
export function signInitData(fields: Record<string, string>, botToken: string): string {
  const dataCheck = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = createHmac('sha256', secret).update(dataCheck).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}
