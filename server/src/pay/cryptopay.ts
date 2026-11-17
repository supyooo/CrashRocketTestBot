/**
 * Crypto Pay API (@CryptoBot): https://help.crypt.bot/crypto-pay-api
 *
 * Deposits are invoices the player pays inside CryptoBot (from any network CryptoBot accepts); withdrawals are
 * transfers to the player's CryptoBot wallet by Telegram id, so no address is ever typed. A transfer's spend_id
 * makes it idempotent: the same spend_id is never paid twice, and getTransfers finds it again after a crash.
 */
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type Invoice = {
  invoice_id: number; status: 'active' | 'paid' | 'expired'; asset?: string; amount: string; payload?: string;
  bot_invoice_url: string; mini_app_invoice_url?: string; web_app_invoice_url?: string;
  paid_asset?: string; paid_amount?: string; fee_amount?: string; paid_at?: string;
};
export type Transfer = { transfer_id: number; spend_id?: string; user_id: number; asset: string; amount: string; status: string; completed_at?: string };

/** What the gateway needs from Crypto Pay; tests use a fake. */
export interface PayApi {
  createInvoice(p: { asset: string; amount: string; description: string; payload: string; expiresIn: number }): Promise<Invoice>;
  getInvoices(ids: number[]): Promise<Invoice[]>;
  transfer(p: { userId: number; asset: string; amount: string; spendId: string; comment: string }): Promise<Transfer>;
  getTransfers(spendId: string): Promise<Transfer[]>;
  /** Available balance of an asset, as a decimal string. */
  balance(asset: string): Promise<string>;
}

/** An error Crypto Pay answered with: `name` is its code, such as USER_NOT_FOUND or INSUFFICIENT_FUNDS. */
export class CryptoPayError extends Error { constructor(public name: string, public status: number) { super(name); } }

export const HOSTS = { testnet: 'https://testnet-pay.crypt.bot/api/', mainnet: 'https://pay.crypt.bot/api/' } as const;

export function cryptoPay(token: string, network: keyof typeof HOSTS, url = ''): PayApi {
  const base = url || HOSTS[network];
  async function call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const r = await fetch(base + method, { method: 'POST', headers: { 'content-type': 'application/json', 'Crypto-Pay-API-Token': token }, body: JSON.stringify(params), signal: AbortSignal.timeout(15_000) });
    const d = (await r.json().catch(() => ({ ok: false, error: { name: 'BAD_RESPONSE_' + r.status } }))) as { ok: boolean; result?: T; error?: { name?: string; code?: number } };
    if (!d.ok) throw new CryptoPayError(d.error?.name ?? 'UNKNOWN', d.error?.code ?? r.status);
    return d.result as T;
  }
  return {
    createInvoice: (p) => call<Invoice>('createInvoice', { currency_type: 'crypto', asset: p.asset, amount: p.amount, description: p.description, payload: p.payload,
      expires_in: p.expiresIn, allow_comments: false, allow_anonymous: false }),
    getInvoices: async (ids) => ids.length ? (await call<{ items: Invoice[] }>('getInvoices', { invoice_ids: ids.join(','), count: 1000 })).items : [],
    transfer: (p) => call<Transfer>('transfer', { user_id: p.userId, asset: p.asset, amount: p.amount, spend_id: p.spendId, comment: p.comment, disable_send_notification: false }),
    getTransfers: async (spendId) => (await call<{ items: Transfer[] }>('getTransfers', { spend_id: spendId })).items,
    balance: async (asset) => (await call<{ currency_code: string; available: string }[]>('getBalance')).find((b) => b.currency_code === asset)?.available ?? '0'
  };
}

/** Webhook check: the body's HMAC-SHA256 keyed with SHA-256 of the app token. */
export function verifyWebhook(token: string, rawBody: string, signature: string | undefined): boolean {
  if (!signature) return false;
  const key = createHash('sha256').update(token).digest();
  const want = createHmac('sha256', key).update(rawBody).digest();
  const got = Buffer.from(signature, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}
