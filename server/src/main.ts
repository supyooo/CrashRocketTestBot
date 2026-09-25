/**
 * One process for now, split into modules (auth, wallet, game, store). The game loop, the API and later the
 * bot can move into separate processes without changing the modules.
 *
 * Storage: Postgres when DATABASE_URL is set (the dev JSON file, if present, is imported once into an empty
 * database), otherwise the JSON file for local development.
 */
import { config } from './config.js';
import { FileStore, type Store } from './store/store.js';
import { PgStore } from './store/pg.js';
import { Wallet } from './wallet/wallet.js';
import { Engine } from './game/engine.js';
import { createApi } from './http.js';
import { attachWs } from './ws.js';

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
const engine = await Engine.create(config, store, wallet);
const api = createApi({ cfg: config, store, wallet, engine });
attachWs(api, config, engine, wallet);

await engine.start(Date.now());
const loop = setInterval(() => engine.step(Date.now()), 20);

api.listen(config.port, () => {
  console.log(`crash-rocket server on :${config.port} · edge ${config.edgeBps / 100}% · ${config.devAuth ? 'DEV logins enabled' : 'Telegram logins only'}`);
  console.log(`fairness commitment: ${engine.commitment}`);
});

async function shutdown() {
  clearInterval(loop);
  api.close();
  await engine.settled();
  await store.close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());
