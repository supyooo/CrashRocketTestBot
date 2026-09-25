import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signInitData, validateInitData } from '../src/auth/telegram.js';
import { signSession, verifySession } from '../src/auth/session.js';

const TOKEN = '123456:TEST-token';
const fields = () => ({ auth_date: String(Math.floor(Date.now() / 1000)), query_id: 'AAE', user: JSON.stringify({ id: 42, first_name: 'Ann', username: 'ann' }), start_param: 'ref_7' });

test('valid Telegram init data is accepted and parsed', () => {
  const d = validateInitData(signInitData(fields(), TOKEN), TOKEN);
  assert.equal(d.user.id, 42);
  assert.equal(d.startParam, 'ref_7');
});

test('tampered user id or another bot token is rejected', () => {
  const good = new URLSearchParams(signInitData(fields(), TOKEN));
  good.set('user', JSON.stringify({ id: 1, first_name: 'Evil' }));
  assert.throws(() => validateInitData(good.toString(), TOKEN), /bad signature/);
  assert.throws(() => validateInitData(signInitData(fields(), TOKEN), '999:other'), /bad signature/);
});

test('old init data is rejected', () => {
  const f = { ...fields(), auth_date: String(Math.floor(Date.now() / 1000) - 3 * 24 * 3600) };
  assert.throws(() => validateInitData(signInitData(f, TOKEN), TOKEN), /expired/);
});

test('session tokens verify and cannot be forged', () => {
  const t = signSession({ uid: 'tg:42', name: 'Ann' }, 'secret');
  assert.equal(verifySession(t, 'secret')?.uid, 'tg:42');
  assert.equal(verifySession(t, 'other'), null);
  const [body, mac] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: 'tg:1', name: 'x', exp: 9e9 })).toString('base64url') + '.' + mac;
  assert.equal(verifySession(forged, 'secret'), null);
  assert.ok(body);
});
