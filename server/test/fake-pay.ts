/** A Crypto Pay stand-in for tests: invoices the test pays by hand, transfers kept by spend_id, errors on demand. */
import { CryptoPayError, type Invoice, type PayApi, type Transfer } from '../src/pay/cryptopay.js';

export class FakePay implements PayApi {
  invoices = new Map<number, Invoice>();
  transfers: Transfer[] = [];
  balanceUsdt = '1000';
  /** The next transfer fails with this Crypto Pay error name, once. */
  failNext: string | null = null;
  /** The next transfer goes out, then the call fails as if the answer was lost on the way. */
  loseAnswer = false;
  private seq = 100;

  async createInvoice(p: { asset: string; amount: string; payload: string }): Promise<Invoice> {
    const id = ++this.seq;
    const inv: Invoice = { invoice_id: id, status: 'active', asset: p.asset, amount: p.amount, payload: p.payload, bot_invoice_url: `https://t.me/CryptoTestnetBot?start=IV${id}` };
    this.invoices.set(id, inv);
    return { ...inv };
  }
  async getInvoices(ids: number[]) { return ids.map((i) => this.invoices.get(i)).filter(Boolean).map((i) => ({ ...i! })); }
  async transfer(p: { userId: number; asset: string; amount: string; spendId: string }): Promise<Transfer> {
    if (this.failNext) { const n = this.failNext; this.failNext = null; throw new CryptoPayError(n, 400); }
    if (this.transfers.some((t) => t.spend_id === p.spendId)) throw new CryptoPayError('SPEND_ID_ALREADY_USED', 400);
    const t: Transfer = { transfer_id: ++this.seq, spend_id: p.spendId, user_id: p.userId, asset: p.asset, amount: p.amount, status: 'completed' };
    this.transfers.push(t);
    if (this.loseAnswer) { this.loseAnswer = false; throw new Error('socket hang up'); }
    return t;
  }
  async getTransfers(spendId: string) { return this.transfers.filter((t) => t.spend_id === spendId); }
  async balance() { return this.balanceUsdt; }

  /** The player pays an invoice in CryptoBot. */
  pay(id: number, fee = '0.30') { const i = this.invoices.get(id)!; i.status = 'paid'; i.paid_amount = i.amount; i.fee_amount = fee; return { ...i }; }
  /** The id of the invoice behind a deposit link. */
  idOf(url: string) { return Number(url.match(/IV(\d+)/)![1]); }
}
