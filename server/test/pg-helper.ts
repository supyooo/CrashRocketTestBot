/** Starts a throwaway real Postgres for tests (embedded-postgres downloads nothing at runtime; binaries come with the npm package). */
import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createServer } from 'node:net';

/** A port nothing is listening on right now. */
function freePort(): Promise<number> {
  return new Promise((resolve, reject) => { const srv = createServer(); srv.unref(); srv.on('error', reject); srv.listen(0, '127.0.0.1', () => { const p = (srv.address() as { port: number }).port; srv.close(() => resolve(p)); }); });
}

export async function startPg(port?: number) {
  port ??= await freePort();
  const dir = join(tmpdir(), 'cr-pg-' + randomBytes(4).toString('hex')); // must not exist yet
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'test', port, persistent: true, onLog: () => {}, onError: () => {} });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('crash');
  return { url: `postgres://postgres:test@127.0.0.1:${port}/crash`, stop: () => pg.stop() };
}
