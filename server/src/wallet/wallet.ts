/** The only module that changes balances. Every call is idempotent through its ledger `ref`. */
import type { Store } from '../store/store.js';

export class Wallet {
  constructor(private store: Store) {}

  balance(uid: string) { return this.store.balance(uid); }

  grant(uid: string, amount: number, ref: string) {
    return this.store.applyLedger([{ uid, delta: amount, kind: 'grant', ref }])[0]!.balance;
  }

  /** Takes a stake; throws InsufficientFunds and changes nothing if the balance is too low. */
  stake(uid: string, amount: number, ref: string) {
    return this.store.applyLedger([{ uid, delta: -amount, kind: 'bet', ref }])[0]!.balance;
  }

  pay(uid: string, amount: number, ref: string) {
    return this.store.applyLedger([{ uid, delta: amount, kind: 'win', ref }])[0]!.balance;
  }

  refund(uid: string, amount: number, ref: string) {
    return this.store.applyLedger([{ uid, delta: amount, kind: 'refund', ref }])[0]!.balance;
  }
}
