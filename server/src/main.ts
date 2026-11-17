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
import { cryptoPay } from './pay/cryptopay.js';
import { PayGateway } from './pay/gateway.js';
import { Admin } from './admin/admin.js';
import { SupportBot } from './support/bot.js';
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

// USDT through Crypto Pay (config.ts guarantees the testnet and Postgres when it is on)
let pay: PayGateway | undefined;
if (config.pay.enabled && store instanceof PgStore) {
  pay = new PayGateway(config, store.db, cryptoPay(config.pay.token, config.pay.network, config.pay.url));
  console.log(`USDT payments through Crypto Pay (${config.pay.network})`);
}

// admin panel (/admin): needs Postgres
let online = () => 0;
const admin = store instanceof PgStore ? new Admin({ cfg: config, db: store.db, ref, pay, online: () => online() }) : undefined;
await admin?.start();
const api = createApi({ cfg: config, store, wallet, ref, pay, admin });
const ws = attachWs(api, config, wallet, (uid) => admin?.isBlocked(uid) ?? false);
online = () => ws.size;
if (admin) console.log(`admin panel at /admin · ${config.admin.ids.length} admin id(s)${config.devAuth && !config.botToken ? ' · DEV logins' : ''}`);
if (pay) {
  pay.on('deposit', (e: { uid: string; amount: number; balance: number }) => {
    ws.toUser(e.uid, { t: 'balance', balance: fromUnits(e.balance) });
    ws.toUser(e.uid, { t: 'pay', kind: 'deposit', status: 'paid', amount: fromUnits(e.amount) });
  });
  pay.on('withdraw', (e: { uid: string; id: number; status: string; amount: number; balance?: number; error?: string }) => {
    if (e.balance !== undefined) ws.toUser(e.uid, { t: 'balance', balance: fromUnits(e.balance) });
    ws.toUser(e.uid, { t: 'pay', kind: 'withdraw', id: e.id, status: e.status, amount: fromUnits(e.amount), error: e.error });
  });
  pay.on('review', (e: { uid: string; id: number; amount: number }) => void admin?.notify(`Вывод на проверку: ${fromUnits(e.amount)} USDT от ${e.uid} (заявка #${e.id}). Откройте админку: /admin`));
  pay.on('low', (e: { id: number; amount: number }) => void admin?.notify(`Не хватает USDT в Crypto Pay для вывода #${e.id} (${fromUnits(e.amount)} USDT). Пополните баланс приложения.`));
}
let loop: NodeJS.Timeout | undefined;

api.listen(config.port, () => console.log(`crash-rocket server on :${config.port} · edge ${config.edgeBps / 100}% · ${config.devAuth ? 'DEV logins enabled' : 'Telegram logins only'}`));

if (store instanceof PgStore) await store.becomeLeader(() => console.log('waiting for the previous server to finish its round…'));
if (pay) { const n = await pay.resetBalances(); if (n) console.log(`switched to USDT: reset ${n} old balances`); }
const engine = await Engine.create(config, store, wallet);
ref.engine = engine;
ws.setEngine(engine);
await engine.start(Date.now());
loop = setInterval(() => engine.step(Date.now()), 20);
pay?.start(); // only the leader watches invoices and sends payouts
// support bot (the game bot answers the FAQ and passes tickets to operators): only the leader polls Telegram
const support = config.botToken && config.support.enabled && store instanceof PgStore ? new SupportBot({ cfg: config, db: store.db, wallet }) : undefined;
if (support) { await support.start(); console.log(`support bot polling · tickets to ${config.support.chatId ? 'the support chat' : 'admins in private'}`); }
console.log(`running rounds · fairness commitment: ${engine.commitment}`);

let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`${signal}: finishing the current round before stopping…`);
  const t0 = Date.now();
  await Promise.race([engine.drain(), new Promise((r) => setTimeout(r, DRAIN_MAX_MS))]);
  if (loop) clearInterval(loop);
  pay?.stop();
  await support?.stop();
  admin?.stop();
  console.log(`round finished in ${Math.round((Date.now() - t0) / 1000)} s, handing over`);
  ws.closeAll(1012, 'server update');
  api.close();
  await store.close(); // releases the leader lock
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
