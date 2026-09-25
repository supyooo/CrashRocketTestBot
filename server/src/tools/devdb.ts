/**
 * Local Postgres for development without Docker: npm run devdb
 * Keeps running until stopped; data lives in server/data/pg so it survives restarts.
 * Then start the server with DATABASE_URL=postgres://postgres:dev@127.0.0.1:54320/crash
 */
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';

const dir = 'data/pg', port = Number(process.env.DEVDB_PORT ?? 54320);
const fresh = !existsSync(dir);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'dev', port, persistent: true, onLog: () => {} });
if (fresh) await pg.initialise();
await pg.start();
if (fresh) await pg.createDatabase('crash');
console.log(`dev postgres ready: postgres://postgres:dev@127.0.0.1:${port}/crash`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.on('SIGINT', () => void stop());
process.on('SIGTERM', () => void stop());
