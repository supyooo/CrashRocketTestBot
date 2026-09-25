/**
 * One process for now, split into modules (auth, wallet, game, store). The game loop, the API and later the
 * bot can move into separate processes without changing the modules.
 */
import { config } from './config.js';
import { FileStore } from './store/store.js';
import { Wallet } from './wallet/wallet.js';
import { Engine } from './game/engine.js';
import { createApi } from './http.js';
import { attachWs } from './ws.js';

const store = new FileStore(config.dataFile);
const wallet = new Wallet(store);
const engine = new Engine(config, store, wallet);
const api = createApi({ cfg: config, store, wallet, engine });
attachWs(api, config, engine, wallet);

engine.start(Date.now());
const loop = setInterval(() => engine.step(Date.now()), 20);

api.listen(config.port, () => {
  console.log(`crash-rocket server on :${config.port} · edge ${config.edgeBps / 100}% · ${config.devAuth ? 'DEV logins enabled' : 'Telegram logins only'}`);
  console.log(`fairness commitment: ${engine.commitment}`);
});

function shutdown() {
  clearInterval(loop);
  store.flush();
  api.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
