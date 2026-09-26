/**
 * The blockchain side of the TON gateway, behind a small interface so the gateway logic can be tested
 * against a fake chain. `ToncenterChain` talks to the real TON testnet through toncenter.com.
 */
import { TonClient, WalletContractV4, internal, SendMode } from '@ton/ton';
import { mnemonicToPrivateKey, type KeyPair } from '@ton/crypto';
import { Address, beginCell, Cell, type Transaction } from '@ton/core';

/** An incoming transfer to the house wallet, as the gateway needs it. */
export type InTx = { hash: string; lt: string; source: string; nano: bigint; comment: string; ok: boolean };

export interface TonChain {
  /** House wallet address (raw form). */
  readonly house: string;
  seqno(): Promise<number>;
  balance(): Promise<bigint>;
  /** Incoming transfers, newest first; `before` pages to older ones. */
  incoming(limit: number, before?: { lt: string; hash: string }): Promise<InTx[]>;
  /** Sends from the house wallet with exactly this seqno; the wallet contract rejects a reused seqno. */
  send(seqno: number, toRaw: string, nano: bigint, comment: string): Promise<void>;
}

export function commentCell(text: string): Cell {
  return beginCell().storeUint(0, 32).storeStringTail(text).endCell();
}
/** base64 BOC of a text comment, for TON Connect's `payload`. */
export function commentPayload(text: string): string {
  return commentCell(text).toBoc().toString('base64');
}
export function readComment(body: Cell | undefined | null): string {
  if (!body) return '';
  try {
    const s = body.beginParse();
    if (s.remainingBits < 32 || s.loadUint(32) !== 0) return '';
    return s.loadStringTail().trim();
  } catch { return ''; }
}

/** User-facing address: testnet flag set, non-bounceable (safe for wallets that are not deployed yet). */
export function friendly(raw: string): string {
  return Address.parseRaw(raw).toString({ testOnly: true, bounceable: false, urlSafe: true });
}

/** Parses an address typed or picked by a player. Friendly forms must carry the testnet flag. */
export function parseTestnetAddress(input: string): string {
  const s = input.trim();
  if (Address.isRaw(s)) return Address.parseRaw(s).toRawString();
  const f = Address.parseFriendly(s);
  if (!f.isTestOnly) throw new Error('this is a mainnet address; only testnet addresses are accepted');
  return f.address.toRawString();
}

export function toInTx(tx: Transaction): InTx | null {
  const msg = tx.inMessage;
  if (!msg || msg.info.type !== 'internal') return null;
  const aborted = tx.description.type === 'generic' && tx.description.aborted;
  return {
    hash: tx.hash().toString('hex'), lt: tx.lt.toString(),
    source: msg.info.src.toRawString(), nano: msg.info.value.coins,
    comment: readComment(msg.body), ok: !aborted && !msg.info.bounced
  };
}

export class ToncenterChain implements TonChain {
  private constructor(private client: TonClient, private key: KeyPair, private wallet: WalletContractV4) {}
  get house() { return this.wallet.address.toRawString(); }

  static async create(endpoint: string, apiKey: string, mnemonic: string): Promise<ToncenterChain> {
    const key = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
    const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
    return new ToncenterChain(new TonClient({ endpoint, apiKey: apiKey || undefined }), key, wallet);
  }

  seqno() { return this.client.open(this.wallet).getSeqno(); }
  balance() { return this.client.getBalance(this.wallet.address); }

  async incoming(limit: number, before?: { lt: string; hash: string }): Promise<InTx[]> {
    const txs = await this.client.getTransactions(this.wallet.address, { limit, lt: before?.lt, hash: before ? Buffer.from(before.hash, 'hex').toString('base64') : undefined, archival: true });
    return txs.map(toInTx).filter((t): t is InTx => t !== null);
  }

  async send(seqno: number, toRaw: string, nano: bigint, comment: string) {
    await this.client.open(this.wallet).sendTransfer({
      seqno, secretKey: this.key.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [internal({ to: Address.parseRaw(toRaw), value: nano, bounce: false, body: commentCell(comment) })]
    });
  }
}
