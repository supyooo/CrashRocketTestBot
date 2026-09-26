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
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: 'postgres', password: 'test', port, persistent: true, onLog: () => {}, onError: () => {},
    // Postgres 18 io workers inherit the output pipes and can outlive the server, keeping the test process alive
    postgresFlags: ['-c', 'io_method=sync'] });
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('crash');
  // On Windows pg.stop() sometimes never settles; give it a few seconds, then kill the server so the test process can exit.
  const stop = async () => {
    await Promise.race([pg.stop().catch(() => {}), new Promise((r) => setTimeout(r, 8000).unref())]);
    const proc = (pg as unknown as { process?: import('node:child_process').ChildProcess }).process;
    try { proc?.kill('SIGKILL'); proc?.stdout?.destroy(); proc?.stderr?.destroy(); proc?.unref(); } catch { /* already gone */ }
  };
  return { url: `postgres://postgres:test@127.0.0.1:${port}/crash`, stop };
}
