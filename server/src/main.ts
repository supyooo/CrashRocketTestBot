/**
 * One process for now, split into modules (auth, wallet, game, store). The game loop, the API and later the
 * bot can move into separate processes without changing the modules.
 *
 * Storage: Postgres when DATABASE_URL is set (the dev JSON file, if present, is imported once into an empty
 * database), otherwise the JSON file for local development.
 *
 * Deploys without broken rounds: the new server starts serving right away but only runs rounds after it takes
 * the leader lock; the old one, on SIGTERM, opens no new round, lets the current one finish, then exits and
 * releases the lock. Players reconnect by themselves.
 */
import { config } from './config.js';
import { FileStore, type Store } from './store/store.js';
import { PgStore } from './store/pg.js';
import { Wallet } from './wallet/wallet.js';
import { Engine } from './game/engine.js';
import { createApi, type EngineRef } from './http.js';
import { attachWs } from './ws.js';
import { ToncenterChain } from './ton/chain.js';
import { TonGateway } from './ton/gateway.js';
import { fromUnits } from './config.js';

const DRAIN_MAX_MS = Number(process.env.DRAIN_MAX_MS ?? 150_000);

async function openStore(): Promise<Store> {
  const url = process.env.DATABASE_URL;
  if (!url) return new FileStore(config.dataFile);
  const pg = await PgStore.open(url);
  const snap = FileStore.read(config.dataFile);
  if (snap && (await pg.importSnapshot(snap))) console.log(`imported ${snap.users.length} users and ${snap.ledger.length} ledger entries from ${config.dataFile}`);
  console.log('storage: postgres');
  return pg;
}

const store = await openStore();
const wallet = new Wallet(store);
const ref: EngineRef = { engine: null };

// test TON gateway (config.ts guarantees testnet and Postgres when it is on)
let ton: TonGateway | undefined;
if (config.ton.enabled && store instanceof PgStore) {
  const chain = await ToncenterChain.create(config.ton.endpoint, config.ton.apiKey, config.ton.mnemonic);
  ton = new TonGateway(config, store.db, chain);
  console.log(`test TON gateway · house wallet ${chain.house}`);
}

const api = createApi({ cfg: config, store, wallet, ref, ton });
const ws = attachWs(api, config, wallet);
if (ton) {
  ton.on('deposit', (e: { uid: string; amount: number; balance: number }) => {
    ws.toUser(e.uid, { t: 'balance', balance: fromUnits(e.balance) });
    ws.toUser(e.uid, { t: 'ton', kind: 'deposit', status: 'credited', amount: fromUnits(e.amount) });
  });
  ton.on('withdraw', (e: { uid: string; id: number; status: string; amount: number; balance?: number }) => {
    if (e.balance !== undefined) ws.toUser(e.uid, { t: 'balance', balance: fromUnits(e.balance) });
    ws.toUser(e.uid, { t: 'ton', kind: 'withdraw', id: e.id, status: e.status, amount: fromUnits(e.amount) });
  });
}
let loop: NodeJS.Timeout | undefined;

api.listen(config.port, () => console.log(`crash-rocket server on :${config.port} · edge ${config.edgeBps / 100}% · ${config.devAuth ? 'DEV logins enabled' : 'Telegram logins only'}`));

if (store instanceof PgStore) await store.becomeLeader(() => console.log('waiting for the previous server to finish its round…'));
if (ton) { const n = await ton.resetPlayMoney(); if (n) console.log(`switched to test TON: reset ${n} play-money balances`); }
const engine = await Engine.create(config, store, wallet);
ref.engine = engine;
ws.setEngine(engine);
await engine.start(Date.now());
loop = setInterval(() => engine.step(Date.now()), 20);
ton?.start(); // only the leader watches deposits and sends payouts
console.log(`running rounds · fairness commitment: ${engine.commitment}`);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: finishing the current round before stopping…`);
  const t0 = Date.now();
  await Promise.race([engine.drain(), new Promise((r) => setTimeout(r, DRAIN_MAX_MS))]);
  if (loop) clearInterval(loop);
  ton?.stop();
  console.log(`round finished in ${Math.round((Date.now() - t0) / 1000)} s, handing over`);
  ws.closeAll(1012, 'server update');
  api.close();
  await store.close(); // releases the leader lock
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
