/**
 * The blockchain side of the TON gateway, behind a small interface so the gateway logic can be tested
 * against a fake chain. `ToncenterChain` talks to the real TON testnet through toncenter.com.
 */
import { TonClient, WalletContractV4, WalletContractV5R1, internal, SendMode } from '@ton/ton';
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
  // "aborted" alone does not mean the money went back: every transfer to a wallet that has not sent anything yet
  // (not deployed) is aborted, and the coins stay. They go back only when the transaction has a bounce phase.
  const d = tx.description;
  const returned = d.type === 'generic' && d.bouncePhase?.type === 'ok';
  return {
    hash: tx.hash().toString('hex'), lt: tx.lt.toString(),
    source: msg.info.src.toRawString(), nano: msg.info.value.coins,
    comment: readComment(msg.body), ok: !returned && !msg.info.bounced
  };
}

/**
 * One mnemonic gives a different address per wallet version. Tonkeeper creates W5 wallets (and a W5 wallet id also
 * depends on the network), older wallets are v4. The server looks at all of them and uses the one holding test TON.
 */
export const WALLET_KINDS = ['w5-testnet', 'w5', 'v4'] as const;
export type WalletKind = (typeof WALLET_KINDS)[number];
type HouseWallet = WalletContractV4 | WalletContractV5R1;
/** toncenter answers 429 above its rate limit (1 request/s without an API key): wait and try again. */
async function retry<T>(f: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await f(); } catch (err) { if (i >= tries) throw err; await new Promise((r) => setTimeout(r, 1500 * i)); }
  }
}
function makeWallet(kind: WalletKind, publicKey: Buffer): HouseWallet {
  if (kind === 'v4') return WalletContractV4.create({ workchain: 0, publicKey });
  return WalletContractV5R1.create({ publicKey, walletId: { networkGlobalId: kind === 'w5-testnet' ? -3 : -239, context: { workchain: 0, subwalletNumber: 0, walletVersion: 'v5r1' } } });
}

export class ToncenterChain implements TonChain {
  private constructor(private client: TonClient, private key: KeyPair, private wallet: HouseWallet, readonly kind: WalletKind,
    /** Every address this mnemonic can have, with its test TON balance (empty when the kind was pinned). */
    readonly candidates: { kind: WalletKind; address: string; nano: bigint }[]) {}
  get house() { return this.wallet.address.toRawString(); }

  /** `pin` forces a wallet kind; otherwise the one with the largest balance wins (W5 testnet when all are empty). */
  static async create(endpoint: string, apiKey: string, mnemonic: string, pin?: string): Promise<ToncenterChain> {
    const key = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
    const client = new TonClient({ endpoint, apiKey: apiKey || undefined });
    if (pin) {
      if (!(WALLET_KINDS as readonly string[]).includes(pin)) throw new Error(`TON_WALLET must be one of ${WALLET_KINDS.join(', ')}`);
      return new ToncenterChain(client, key, makeWallet(pin as WalletKind, key.publicKey), pin as WalletKind, []);
    }
    const found: { kind: WalletKind; address: string; nano: bigint }[] = [];
    for (const kind of WALLET_KINDS) {
      const w = makeWallet(kind, key.publicKey);
      found.push({ kind, address: w.address.toRawString(), nano: await retry(() => client.getBalance(w.address)) });
    }
    const best = found.reduce((a, b) => (b.nano > a.nano ? b : a));
    return new ToncenterChain(client, key, makeWallet(best.kind, key.publicKey), best.kind, found);
  }

  seqno() { return this.client.open(this.wallet as WalletContractV4).getSeqno(); }
  balance() { return this.client.getBalance(this.wallet.address); }

  async incoming(limit: number, before?: { lt: string; hash: string }): Promise<InTx[]> {
    const txs = await this.client.getTransactions(this.wallet.address, { limit, lt: before?.lt, hash: before ? Buffer.from(before.hash, 'hex').toString('base64') : undefined, archival: true });
    return txs.map(toInTx).filter((t): t is InTx => t !== null);
  }

  async send(seqno: number, toRaw: string, nano: bigint, comment: string) {
    const args = {
      seqno, secretKey: this.key.secretKey,
      sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
      messages: [internal({ to: Address.parseRaw(toRaw), value: nano, bounce: false, body: commentCell(comment) })]
    };
    if (this.wallet instanceof WalletContractV5R1) await this.client.open(this.wallet).sendTransfer(args);
    else await this.client.open(this.wallet).sendTransfer(args);
  }
}
