/** Support bot: the FAQ tree, menu navigation, tickets to the operators and their replies back to the player. */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { config, toUnits } from '../src/config.js';
import { PgStore } from '../src/store/pg.js';
import { Wallet } from '../src/wallet/wallet.js';
import { SupportBot, TgError, type TgApi } from '../src/support/bot.js';
import { buildFaq, faqParams, parents, ROOT } from '../src/support/faq.js';
import { startPg } from './pg-helper.js';

let url = '', stop: () => Promise<void> = async () => {};
const opened: PgStore[] = [];
before(async () => { const p = await startPg(); url = p.url; stop = p.stop; });
after(async () => { for (const s of opened) await s.close().catch(() => {}); await stop(); });

const OPS = -100123, PLAYER = 555;
type Call = { method: string; p: Record<string, any> };   // eslint-disable-line @typescript-eslint/no-explicit-any

let n = 0;
async function setup(over: Partial<typeof config.support> = {}, adminIds = config.admin.ids) {
  const name = 'sup_t' + ++n;
  const c = new pg.Client(url); await c.connect(); await c.query(`CREATE DATABASE ${name}`); await c.end();
  const store = await PgStore.open(url.replace(/\/crash$/, '/' + name)); opened.push(store);
  const wallet = new Wallet(store);
  const calls: Call[] = [];
  let msgId = 1000;
  const blocked = new Set<number>();
  const api: TgApi = async (method, p) => {
    calls.push({ method, p });
    if (blocked.has(Number(p.chat_id))) throw new TgError(403, 'Forbidden: bot was blocked by the user');
    if (method === 'sendMessage' || method === 'copyMessage') return { message_id: ++msgId };
    return true;
  };
  const cfg = { ...config, botToken: '1:T', admin: { ...config.admin, ids: adminIds }, support: { ...config.support, chatId: String(OPS), publicUrl: 'https://srv.example', ...over } };
  const bot = new SupportBot({ cfg, db: store.db, wallet, api });
  const sent = (chat: number, method = 'sendMessage') => calls.filter((c) => c.method === method && Number(c.p.chat_id) === chat);
  return { store, wallet, bot, calls, sent, blocked, cfg };
}

let upd = 1, mid = 1;
const from = { id: PLAYER, first_name: 'Ann', username: 'ann', language_code: 'ru' };
const say = (text: string) => ({ update_id: upd++, message: { message_id: mid++, chat: { id: PLAYER, type: 'private' }, from, text } });
const tap = (data: string) => ({ update_id: upd++, callback_query: { id: 'q' + upd, from, data, message: { message_id: 1, chat: { id: PLAYER, type: 'private' } } } });
const opReply = (to: number, text: string) => ({ update_id: upd++, message: { message_id: mid++, chat: { id: OPS, type: 'supergroup' }, from: { id: 9, first_name: 'Op' }, text, reply_to_message: { message_id: to } } });
const buttons = (p: Record<string, any>) => (p.reply_markup?.inline_keyboard ?? []).flat().map((b: { text: string; callback_data?: string }) => b.callback_data ?? b.text);   // eslint-disable-line @typescript-eslint/no-explicit-any

test('the FAQ tree: every button leads somewhere, every node is reachable, texts fit Telegram', () => {
  const faq = buildFaq(faqParams(config)), par = parents(faq);
  for (const node of faq.values()) {
    for (const k of node.kids ?? []) assert.ok(faq.has(k), `${node.id} -> ${k} is missing`);
    if (node.id !== ROOT) assert.ok(par.has(node.id), `${node.id} cannot be reached from the main menu`);
    for (const l of ['ru', 'en'] as const) {
      assert.ok(node.title[l], `${node.id} has no ${l} title`);
      assert.ok((node.text?.[l] ?? '').length < 3800, `${node.id} ${l} text is too long`);
      if (node.ask) assert.ok(node.text?.[l], `${node.id} asks for details but says nothing`);
    }
    assert.ok(Buffer.byteLength('f:' + node.id) <= 64);
  }
  // the answers quote the server's limits
  assert.match(faq.get('g_lim')!.text!.ru, /15 TON на одну панель/);
  assert.match(faq.get('g_lim')!.text!.ru, /75 TON/);
  assert.match(faq.get('g_lim')!.text!.ru, /95%/);
  // the model's escalations (red boxes) are all there
  for (const id of ['dep_miss', 'wd_late', 'wd_off', 'g_norefund', 's_unfrz', 's_appeal', 'r_nofriend', 'b_ask', 't_op']) assert.ok(faq.get(id)?.ask, id);
});

test('/start greets with Play and Support; /support and the Support button open the FAQ menu', async () => {
  const { bot, sent } = await setup();
  await bot.handle(say('/start'));
  assert.deepEqual(buttons(sent(PLAYER)[0]!.p), ['🚀 Играть', 'f:root']);
  await bot.handle(say('/start support'));
  const menu = sent(PLAYER)[1]!.p;
  assert.match(menu.text, /Поддержка Boomy/);
  assert.ok(buttons(menu).includes('f:dep') && buttons(menu).includes('f:partners'));
  await bot.handle(say('/support'));
  assert.match(sent(PLAYER)[2]!.p.text, /Поддержка Boomy/);
});

test('taps edit the menu: sections, answers, Back and Main menu; the language switch', async () => {
  const { bot, calls } = await setup();
  const edits = () => calls.filter((c) => c.method === 'editMessageText');
  await bot.handle(tap('f:wd'));
  assert.deepEqual(buttons(edits()[0]!.p), ['f:wd_how', 'f:wd_time', 'f:wd_cancel', 'f:wd_miss', 'f:wd_off', 'f:root']);
  await bot.handle(tap('f:wd_time'));
  const e = edits()[1]!.p;
  assert.match(e.text, /до 50 TON обрабатывается автоматически/);
  assert.deepEqual(buttons(e), ['f:wd_late', 'f:wd', 'f:root']);
  await bot.handle(tap('lang'));
  assert.match(edits()[2]!.p.text, /Boomy support/);
  await bot.handle(tap('f:nope'));   // unknown ids are ignored
  assert.equal(edits().length, 3);
  assert.equal(calls.filter((c) => c.method === 'answerCallbackQuery').length, 4);
});

test('a ticket: details go to the operators with a header, the player is told 24 hours, follow-ups join the ticket', async () => {
  const { bot, sent, store, wallet, calls } = await setup();
  await store.putUser({ id: 'tg:' + PLAYER, name: '@ann', createdAt: Date.now() });
  await wallet.grant('tg:' + PLAYER, toUnits(12.5), 'g');
  await bot.handle(tap('f:dep_miss'));
  assert.match(calls.at(-1)!.p.text, /Напишите ответ одним сообщением/);
  await bot.handle(say('TXID abc, 5 TON'));
  const head = sent(OPS)[0]!.p;
  assert.match(head.text, /Обращение №1<\/b> · Пополнение → Не пришёл депозит/);
  assert.match(head.text, /@ann \(Ann\)/);
  assert.match(head.text, /Баланс: 12.5 TON/);
  assert.match(head.text, /srv\.example\/admin#p=tg%3A555/);
  const copies = sent(OPS, 'copyMessage');
  assert.equal(copies.length, 1);
  assert.equal(copies[0]!.p.from_chat_id, PLAYER);
  assert.match(sent(PLAYER).at(-1)!.p.text, /№1 принято. Ответ поступит в течение 24 часов/);
  // a second message (a screenshot) joins the same ticket, without another "24 hours"
  const before = sent(PLAYER).length;
  await bot.handle(say('screenshot'));
  assert.equal(sent(OPS, 'copyMessage').length, 2);
  assert.equal(sent(OPS).length, 1);                     // still one header
  assert.equal(sent(PLAYER).length, before);
  const t = await store.db.query('SELECT uid, topic, status FROM support_tickets');
  assert.deepEqual(t.rows, [{ uid: 'tg:555', topic: 'dep_miss', status: 'open' }]);
});

test('operators reply to any ticket message; /close closes it; a blocked player is reported', async () => {
  const { bot, sent, store, blocked } = await setup();
  await bot.handle(tap('f:wd_late'));
  await bot.handle(say('10 TON, 3 days ago'));
  const headId = (await store.db.query("SELECT msg_id FROM support_messages WHERE kind = 'head'")).rows[0].msg_id;
  await bot.handle(opReply(Number(headId), 'Проверили, вывод отправлен'));
  const toPlayer = sent(PLAYER, 'copyMessage');
  assert.equal(toPlayer.length, 1);
  assert.equal(toPlayer[0]!.p.from_chat_id, OPS);
  assert.equal((await store.db.query('SELECT status FROM support_tickets')).rows[0].status, 'answered');
  // the player answers back: it reaches the operators and reopens the ticket
  await bot.handle(say('спасибо, пришло'));
  assert.equal(sent(OPS, 'copyMessage').length, 2);
  assert.equal((await store.db.query('SELECT status FROM support_tickets')).rows[0].status, 'open');
  // replies to unknown messages and plain chat in the group are ignored
  const n0 = sent(PLAYER).length + sent(PLAYER, 'copyMessage').length;
  await bot.handle(opReply(424242, 'hello'));
  await bot.handle({ update_id: upd++, message: { message_id: mid++, chat: { id: OPS, type: 'supergroup' }, from: { id: 9 }, text: 'обед' } });
  assert.equal(sent(PLAYER).length + sent(PLAYER, 'copyMessage').length, n0);
  // /close
  await bot.handle(opReply(Number(headId), '/close'));
  assert.equal((await store.db.query('SELECT status FROM support_tickets')).rows[0].status, 'closed');
  assert.match(sent(PLAYER).at(-1)!.p.text, /№1 закрыто/);
  // after closing, free text gets the menu, not the operators
  const ops = sent(OPS, 'copyMessage').length;
  await bot.handle(say('ещё вопрос'));
  assert.equal(sent(OPS, 'copyMessage').length, ops);
  assert.match(sent(PLAYER).at(-1)!.p.text, /Выберите раздел/);
  // a player who blocked the bot: the operator is told
  blocked.add(PLAYER);
  await bot.handle(opReply(Number(headId), 'ещё ответ'));
  assert.match(sent(OPS).at(-1)!.p.text, /не доставлен: игрок заблокировал бота/);
});

test('without a support chat tickets go to the admins; leaving an answer that asks for details cancels the wait', async () => {
  const { bot, sent } = await setup({ chatId: '' }, ['777', '778']);
  assert.deepEqual(bot.opChats, [777, 778]);
  await bot.handle(tap('f:t_op'));
  await bot.handle(say('quest X'));
  assert.equal(sent(777).length, 1);
  assert.equal(sent(778).length, 1);
  assert.equal(sent(777, 'copyMessage').length, 1);
  // a new topic: tap an answer that asks, then go elsewhere; the next message is not a new ticket
  await bot.handle(tap('f:s_appeal'));
  await bot.handle(tap('f:game'));
  await bot.handle(say('hi'));
  assert.equal(sent(777).length, 1);   // no second header
});

test('polling: handles updates in order and saves the offset, so a restart does not answer twice', async () => {
  const name = 'sup_poll';
  const c = new pg.Client(url); await c.connect(); await c.query(`CREATE DATABASE ${name}`); await c.end();
  const store = await PgStore.open(url.replace(/\/crash$/, '/' + name)); opened.push(store);
  const offsets: number[] = [], replies: number[] = [];
  let batch = [say('/support'), say('/start')];
  const lastId = batch[1]!.update_id;
  const api: TgApi = async (method, p, signal) => {
    if (method === 'getUpdates') {
      offsets.push(Number(p.offset));
      const b = batch; batch = [];
      if (b.length) return b;
      return new Promise((_, rej) => signal?.addEventListener('abort', () => rej(new Error('aborted'))));
    }
    if (method === 'sendMessage') replies.push(Number(p.chat_id));
    return { message_id: 1 };
  };
  const mk = () => new SupportBot({ cfg: { ...config, botToken: '1:T' }, db: store.db, wallet: new Wallet(store), api });
  const b1 = mk(); await b1.start();
  for (let i = 0; i < 100 && offsets.length < 2; i++) await new Promise((r) => setTimeout(r, 10));
  await b1.stop();
  assert.equal(replies.length, 2);
  const saved = (await store.db.query("SELECT value FROM kv WHERE key = 'support_offset'")).rows[0].value;
  assert.equal(saved, offsets[1]);
  assert.equal(offsets[0], 0);
  assert.equal(offsets[1], lastId + 1);
  const b2 = mk(); await b2.start();
  for (let i = 0; i < 100 && offsets.length < 3; i++) await new Promise((r) => setTimeout(r, 10));
  await b2.stop();
  assert.equal(offsets[2], saved);   // continues where the first one stopped
  assert.equal(replies.length, 2);
});

test('/chatid in a group tells its id; a group that becomes a supergroup announces the new id', async () => {
  const { bot, sent } = await setup({ chatId: '' }, ['777']);
  const G = -4001;
  await bot.handle({ update_id: upd++, message: { message_id: mid++, chat: { id: G, type: 'group' }, from: { id: 9 }, text: '/chatid@BoomyBot' } });
  assert.match(sent(G)[0]!.p.text, /id этого чата: <code>-4001<\/code>/);
  assert.match(sent(G)[0]!.p.text, /SUPPORT_CHAT_ID/);
  // other group chatter is ignored
  await bot.handle({ update_id: upd++, message: { message_id: mid++, chat: { id: G, type: 'group' }, from: { id: 9 }, text: 'привет' } });
  assert.equal(sent(G).length, 1);
  // the operators' chat itself says it is set up
  const { bot: b2, sent: s2 } = await setup();
  await b2.handle({ update_id: upd++, message: { message_id: mid++, chat: { id: OPS, type: 'supergroup' }, from: { id: 9 }, text: '/chatid' } });
  assert.match(s2(OPS)[0]!.p.text, /Это чат операторов/);
  // migration to a supergroup
  await b2.handle({ update_id: upd++, message: { message_id: mid++, chat: { id: OPS, type: 'group' }, from: { id: 9 }, migrate_to_chat_id: -1009999 } });
  assert.match(s2(-1009999)[0]!.p.text, /новый id: <code>-1009999<\/code>.*Обновите SUPPORT_CHAT_ID/);
});
