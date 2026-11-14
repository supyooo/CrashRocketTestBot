/**
 * Support bot: the game's own Telegram bot answers players by the support model (docs/support-model.md).
 *
 * - The FAQ is an inline-button menu (faq.ts); taps edit the same message, with "Back" and "Main menu".
 * - Some answers ask the player for details (`ask` nodes). The player's next message opens a ticket: the operators
 *   get a header (topic, player, Telegram id, balance, admin link) and a copy of the message (photos and files
 *   too), the player gets "the answer will come within 24 hours". Further messages of the player go to the same
 *   ticket until an operator closes it.
 * - Operators answer by replying to any message of a ticket in their chat; the bot copies the reply to the player.
 *   A reply "/close" closes the ticket.
 * - Updates come by long polling (getUpdates); only the leader server polls, so a deploy never has two pollers.
 *
 * Operators' chat: SUPPORT_CHAT_ID (a group with the bot in it), or else the ADMIN_IDS in private messages.
 */
import type pg from 'pg';
import type { Config } from '../config.js';
import { fromUnits } from '../config.js';
import type { Wallet } from '../wallet/wallet.js';
import { buildFaq, faqParams, parents, pathOf, ROOT, type FaqNode, type Lang } from './faq.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
/** Calls a Bot API method and returns its `result`; throws TgError on `ok: false`. */
export type TgApi = (method: string, params: Record<string, unknown>, signal?: AbortSignal) => Promise<any>;
export class TgError extends Error { constructor(public code: number, msg: string) { super(msg); } }

export function botApi(token: string): TgApi {
  return async (method, params, signal) => {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params), signal });
    const d = (await r.json().catch(() => ({ ok: false, description: 'bad response ' + r.status }))) as { ok: boolean; result?: unknown; description?: string; error_code?: number };
    if (!d.ok) throw new TgError(d.error_code ?? r.status, d.description ?? 'telegram error');
    return d.result;
  };
}

type TgUserLite = { id: number; first_name?: string; last_name?: string; username?: string; language_code?: string };
type Msg = { message_id: number; chat: { id: number; type: string }; from?: TgUserLite; text?: string; caption?: string; reply_to_message?: { message_id: number }; migrate_to_chat_id?: number };
type Update = { update_id: number; message?: Msg; callback_query?: { id: string; from: TgUserLite; data?: string; message?: Msg } };

const UI = {
  ru: {
    welcome: '<b>Boomy</b> — краш-игра прямо в Telegram: ракета взлетает, множитель растёт, заберите ставку до взрыва!',
    play: '🚀 Играть', support: '💬 Поддержка', back: '⬅️ Назад', home: '🏠 Главное меню', channel: '📣 Наш канал', lang: '🇬🇧 English',
    pick: 'Выберите вопрос:', write: '✍️ Напишите ответ одним сообщением ниже — мы передадим его оператору.',
    accepted: n => `Обращение №${n} принято. Ответ поступит в течение 24 часов. Если хотите что-то добавить, просто напишите сюда.`,
    menuHint: 'Выберите раздел в меню поддержки:', closed: n => `Обращение №${n} закрыто. Если вопрос остался, откройте поддержку снова: /support`,
    operator: '💬 Ответ поддержки:'
  },
  en: {
    welcome: '<b>Boomy</b> is a crash game right inside Telegram: the rocket takes off, the multiplier climbs, cash out before it blows up!',
    play: '🚀 Play', support: '💬 Support', back: '⬅️ Back', home: '🏠 Main menu', channel: '📣 Our channel', lang: '🇷🇺 Русский',
    pick: 'Pick a question:', write: '✍️ Write your answer in one message below and we will pass it to an operator.',
    accepted: n => `Request #${n} received. The answer will come within 24 hours. To add something, just write here.`,
    menuHint: 'Pick a topic in the support menu:', closed: n => `Request #${n} is closed. If you still have a question, open support again: /support`,
    operator: '💬 Support reply:'
  }
} satisfies Record<Lang, Record<string, string | ((n: number) => string)>>;

const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
const langOf = (code?: string): Lang => (/^(ru|uk|be|kk|uz|ky|tg|az|hy|ka)/.test(code ?? 'ru') ? 'ru' : 'en');

type State = { lang: Lang; awaiting: string | null; ticket: number | null };
type Ctx = { cfg: Config; db: pg.Pool; wallet: Wallet; api?: TgApi };

export class SupportBot {
  readonly faq: Map<string, FaqNode>;
  private par: Map<string, string>;
  private api: TgApi;
  /** Where tickets go: the support group, or the admins' private chats. */
  readonly opChats: number[];
  private abort?: AbortController;
  private running?: Promise<void>;

  constructor(private x: Ctx) {
    this.faq = buildFaq(faqParams(x.cfg));
    this.par = parents(this.faq);
    this.api = x.api ?? botApi(x.cfg.botToken);
    const s = x.cfg.support;
    this.opChats = (s.chatId ? [s.chatId] : x.cfg.admin.ids).map(Number).filter((n) => Number.isSafeInteger(n) && n !== 0);
  }

  /** Starts long polling (leader only). */
  async start() {
    if (!this.opChats.length) console.warn('support bot: no SUPPORT_CHAT_ID or ADMIN_IDS, tickets have nowhere to go');
    await this.api('setMyCommands', { commands: [{ command: 'start', description: 'Boomy' }, { command: 'support', description: 'Поддержка / Support' }] }).catch((e) => console.error('support bot: setMyCommands failed:', e.message));
    this.abort = new AbortController();
    this.running = this.poll(this.abort.signal);
  }
  async stop() { this.abort?.abort(); await this.running?.catch(() => {}); }

  private async poll(signal: AbortSignal) {
    let offset = Number((await this.x.db.query("SELECT value FROM kv WHERE key = 'support_offset'")).rows[0]?.value ?? 0);
    let fails = 0;
    while (!signal.aborted) {
      try {
        const ups = (await this.api('getUpdates', { offset, timeout: 25, allowed_updates: ['message', 'callback_query'] }, signal)) as Update[];
        fails = 0;
        for (const u of ups) {
          await this.handle(u).catch((err) => console.error('support bot: update failed:', err));
          offset = u.update_id + 1;
        }
        if (ups.length) await this.x.db.query("INSERT INTO kv (key, value) VALUES ('support_offset', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(offset)]);
      } catch (err) {
        if (signal.aborted) return;
        const e = err as Error & { code?: number };
        // 409: a webhook is set for this bot, or another process polls it
        console.error(`support bot: getUpdates failed${e.code === 409 ? ' (a webhook or another poller holds the bot)' : ''}:`, e.message);
        await new Promise((r) => setTimeout(r, Math.min(60_000, 1000 * 2 ** fails++)));
      }
    }
  }

  /** One Telegram update. Public for tests. */
  async handle(u: Update) {
    if (u.callback_query) return this.onCallback(u.callback_query);
    const m = u.message;
    if (!m?.from) return;
    if (m.chat.type !== 'private' && (await this.onGroupSetup(m))) return;
    if (await this.onOperator(m)) return;
    if (m.chat.type === 'private') return this.onPlayer(m);
  }

  /**
   * Setting up the operators' chat: /chatid in a group answers with its id for SUPPORT_CHAT_ID. When a group
   * becomes a supergroup Telegram gives it a new id: the bot says so in the new chat, since tickets would stop.
   * (With privacy mode on, a group bot gets /chatid@<bot>; a plain /chatid only in some cases.)
   */
  private async onGroupSetup(m: Msg): Promise<boolean> {
    if (m.migrate_to_chat_id) {
      const known = this.opChats.includes(m.chat.id);
      await this.api('sendMessage', { chat_id: m.migrate_to_chat_id, parse_mode: 'HTML',
        text: `Группа стала супергруппой, её новый id: <code>${m.migrate_to_chat_id}</code>.${known ? ' Обновите SUPPORT_CHAT_ID на сервере, иначе обращения сюда не придут.' : ''}` }).catch(() => {});
      return true;
    }
    if (!/^\/chatid(@\w+)?$/.test((m.text ?? '').trim())) return false;
    const on = this.opChats.includes(m.chat.id);
    await this.api('sendMessage', { chat_id: m.chat.id, parse_mode: 'HTML', reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
      text: `id этого чата: <code>${m.chat.id}</code>\n` + (on ? '✅ Это чат операторов: обращения приходят сюда.'
        : 'Чтобы обращения игроков приходили сюда, впишите это число в переменную SUPPORT_CHAT_ID на сервере и перезапустите его.') }).catch(() => {});
    return true;
  }

  // ---------------- players ----------------

  private async state(from: TgUserLite): Promise<State> {
    const { rows } = await this.x.db.query(
      `INSERT INTO support_users (tg_id, lang) VALUES ($1, $2) ON CONFLICT (tg_id) DO UPDATE SET updated_at = now()
       RETURNING lang, awaiting, ticket_id`, [from.id, langOf(from.language_code)]);
    return { lang: rows[0].lang as Lang, awaiting: rows[0].awaiting, ticket: rows[0].ticket_id };
  }
  private setState(tgId: number, patch: Partial<Pick<State, 'lang' | 'awaiting' | 'ticket'>>) {
    const cols: string[] = [], vals: unknown[] = [tgId];
    if ('lang' in patch) { vals.push(patch.lang); cols.push(`lang = $${vals.length}`); }
    if ('awaiting' in patch) { vals.push(patch.awaiting); cols.push(`awaiting = $${vals.length}`); }
    if ('ticket' in patch) { vals.push(patch.ticket); cols.push(`ticket_id = $${vals.length}`); }
    return this.x.db.query(`UPDATE support_users SET ${cols.join(', ')}, updated_at = now() WHERE tg_id = $1`, vals);
  }

  private async onPlayer(m: Msg) {
    const from = m.from!, st = await this.state(from), t = UI[st.lang];
    const cmd = /^\/(\w+)(?:@\w+)?(?:\s+(\S+))?/.exec(m.text ?? '');
    if (cmd) {
      const [, name, arg] = cmd;
      if (name === 'support' || name === 'help' || (name === 'start' && arg === 'support')) return this.sendNode(from.id, ROOT, st);
      if (name === 'start') {
        return this.api('sendMessage', { chat_id: from.id, text: t.welcome, parse_mode: 'HTML', reply_markup: { inline_keyboard: [
          [{ text: t.play, web_app: { url: this.x.cfg.support.appUrl } }], [{ text: t.support, callback_data: 'f:' + ROOT }]] } });
      }
    }
    if (st.awaiting) return this.openTicket(m, st);
    if (st.ticket) {
      const { rows } = await this.x.db.query('SELECT status FROM support_tickets WHERE id = $1', [st.ticket]);
      if (rows[0] && rows[0].status !== 'closed') return this.toOperators(st.ticket, m);
    }
    return this.sendNode(from.id, ROOT, st, t.menuHint);
  }

  private async onCallback(q: NonNullable<Update['callback_query']>) {
    await this.api('answerCallbackQuery', { callback_query_id: q.id }).catch(() => {});
    const msg = q.message;
    if (!msg || msg.chat.type !== 'private' || !q.data) return;
    const st = await this.state(q.from);
    let id = '';
    if (q.data === 'lang') { st.lang = st.lang === 'ru' ? 'en' : 'ru'; await this.setState(q.from.id, { lang: st.lang }); id = ROOT; }
    else if (q.data.startsWith('f:')) id = q.data.slice(2);
    if (!this.faq.has(id)) return;
    const node = this.faq.get(id)!;
    // an answer that asks for details waits for the next message; any other tap means the player went elsewhere
    const awaiting = node.ask ? id : null;
    if (awaiting !== st.awaiting) await this.setState(q.from.id, { awaiting });
    const view = this.view(node, st.lang);
    try { await this.api('editMessageText', { chat_id: msg.chat.id, message_id: msg.message_id, ...view }); }
    catch (err) {
      if (err instanceof TgError && /not modified/.test(err.message)) return;
      await this.api('sendMessage', { chat_id: msg.chat.id, ...view });   // too old to edit, or a photo message
    }
  }

  private async sendNode(chatId: number, id: string, st: State, intro?: string) {
    const node = this.faq.get(id)!;
    if (st.awaiting && !node.ask) await this.setState(chatId, { awaiting: null });
    const view = this.view(node, st.lang);
    return this.api('sendMessage', { chat_id: chatId, ...view, text: intro ? `${intro}\n\n${view.text}` : view.text });
  }

  /** The message for a FAQ node: its title and answer, its buttons, Back and Main menu. */
  view(node: FaqNode, lang: Lang) {
    const t = UI[lang], rows: { text: string; callback_data?: string; url?: string; web_app?: { url: string } }[][] = [];
    for (const k of node.kids ?? []) rows.push([{ text: this.faq.get(k)!.title[lang], callback_data: 'f:' + k }]);
    if (node.id === ROOT) {
      if (this.x.cfg.support.channelUrl) rows.push([{ text: t.channel, url: this.x.cfg.support.channelUrl }]);
      rows.push([{ text: t.play, web_app: { url: this.x.cfg.support.appUrl } }, { text: t.lang, callback_data: 'lang' }]);
    } else {
      const up = this.par.get(node.id) ?? ROOT;
      rows.push(up === ROOT ? [{ text: t.back, callback_data: 'f:' + ROOT }] : [{ text: t.back, callback_data: 'f:' + up }, { text: t.home, callback_data: 'f:' + ROOT }]);
    }
    let text = node.id === ROOT ? `<b>${node.title[lang]}</b>\n\n${node.text![lang]}` : `<b>${node.title[lang]}</b>\n\n${node.text ? node.text[lang] : t.pick}`;
    if (node.ask) text += `\n\n${t.write}`;
    return { text, parse_mode: 'HTML', reply_markup: { inline_keyboard: rows }, link_preview_options: { is_disabled: true } };
  }

  // ---------------- tickets ----------------

  private async openTicket(m: Msg, st: State) {
    const from = m.from!, uid = 'tg:' + from.id, topic = st.awaiting!;
    const { rows } = await this.x.db.query('INSERT INTO support_tickets (tg_id, uid, topic) VALUES ($1, $2, $3) RETURNING id', [from.id, uid, topic]);
    const id = rows[0].id as number;
    await this.setState(from.id, { awaiting: null, ticket: id });
    const head = await this.header(id, from, topic);
    for (const chat of this.opChats) {
      try {
        const h = await this.api('sendMessage', { chat_id: chat, text: head, parse_mode: 'HTML', link_preview_options: { is_disabled: true } });
        await this.remember(id, 'head', chat, h.message_id);
      } catch (err) { console.error(`support bot: ticket #${id} header to ${chat} failed:`, (err as Error).message); }
    }
    await this.toOperators(id, m);
    await this.api('sendMessage', { chat_id: from.id, text: UI[st.lang].accepted(id) });
  }

  private async header(id: number, from: TgUserLite, topic: string) {
    const uid = 'tg:' + from.id;
    const name = [from.first_name, from.last_name].filter(Boolean).join(' ');
    const balance = fromUnits(await this.x.wallet.balance(uid).catch(() => 0));
    const pub = this.x.cfg.support.publicUrl;
    return [
      `🆘 <b>Обращение №${id}</b> · ${esc(pathOf(this.faq, this.par, topic, 'ru'))}`,
      `Игрок: ${from.username ? '@' + esc(from.username) : '—'}${name ? ' (' + esc(name) + ')' : ''}`,
      `Telegram ID: <code>${from.id}</code> · язык ${esc(from.language_code ?? '—')}`,
      `Баланс: ${balance} TON`,
      pub ? `<a href="${esc(pub)}/admin#p=${encodeURIComponent(uid)}">Карточка игрока в админке</a>` : '',
      '',
      '<i>Ответьте реплаем на любое сообщение обращения: бот перешлёт ответ игроку. Реплай /close закрывает обращение.</i>'
    ].filter((l, i) => l || i === 5).join('\n');
  }

  /** Copies a player's message into every operators' chat, as a reply to the ticket's header there. */
  private async toOperators(id: number, m: Msg) {
    const heads = await this.x.db.query("SELECT chat_id, msg_id FROM support_messages WHERE ticket_id = $1 AND kind = 'head'", [id]);
    const headOf = new Map(heads.rows.map((r) => [Number(r.chat_id), Number(r.msg_id)]));
    for (const chat of this.opChats) {
      try {
        const h = headOf.get(chat);
        const c = await this.api('copyMessage', { chat_id: chat, from_chat_id: m.chat.id, message_id: m.message_id,
          ...(h ? { reply_parameters: { message_id: h, allow_sending_without_reply: true } } : {}) });
        await this.remember(id, 'in', chat, c.message_id);
      } catch (err) { console.error(`support bot: ticket #${id} copy to ${chat} failed:`, (err as Error).message); }
    }
    await this.x.db.query("UPDATE support_tickets SET status = CASE WHEN status = 'answered' THEN 'open' ELSE status END, updated_at = now() WHERE id = $1", [id]);
  }

  private remember(ticket: number, kind: 'head' | 'in' | 'out', chat: number, msg: number) {
    return this.x.db.query('INSERT INTO support_messages (ticket_id, kind, chat_id, msg_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING', [ticket, kind, chat, msg]);
  }

  // ---------------- operators ----------------

  /** A reply in an operators' chat to a ticket message: the answer goes to the player. False when it is not one. */
  private async onOperator(m: Msg): Promise<boolean> {
    if (!this.opChats.includes(m.chat.id) || !m.reply_to_message) return false;
    const { rows } = await this.x.db.query(
      `SELECT t.id, t.tg_id, t.status, COALESCE(u.lang, 'ru') AS lang FROM support_messages s JOIN support_tickets t ON t.id = s.ticket_id
       LEFT JOIN support_users u ON u.tg_id = t.tg_id WHERE s.chat_id = $1 AND s.msg_id = $2`, [m.chat.id, m.reply_to_message.message_id]);
    const tk = rows[0];
    if (!tk) return false;
    const id = tk.id as number, player = Number(tk.tg_id), lang = tk.lang as Lang;
    if (/^\/close(@\w+)?$/.test((m.text ?? '').trim())) {
      await this.x.db.query("UPDATE support_tickets SET status = 'closed', updated_at = now() WHERE id = $1", [id]);
      await this.x.db.query('UPDATE support_users SET ticket_id = NULL WHERE tg_id = $1 AND ticket_id = $2', [player, id]);
      await this.api('sendMessage', { chat_id: player, text: UI[lang].closed(id) }).catch(() => {});
      await this.api('sendMessage', { chat_id: m.chat.id, text: `Обращение №${id} закрыто.`, reply_parameters: { message_id: m.message_id } }).catch(() => {});
      return true;
    }
    try {
      await this.api('sendMessage', { chat_id: player, text: UI[lang].operator });
      await this.api('copyMessage', { chat_id: player, from_chat_id: m.chat.id, message_id: m.message_id });
    } catch (err) {
      const why = err instanceof TgError && err.code === 403 ? 'игрок заблокировал бота' : (err as Error).message;
      await this.api('sendMessage', { chat_id: m.chat.id, text: `⚠️ Ответ не доставлен: ${why}`, reply_parameters: { message_id: m.message_id } }).catch(() => {});
      return true;
    }
    await this.remember(id, 'out', m.chat.id, m.message_id);
    // a reopened ticket becomes the player's current one again, so their answer reaches the operators
    await this.x.db.query("UPDATE support_tickets SET status = 'answered', updated_at = now() WHERE id = $1", [id]);
    await this.x.db.query('UPDATE support_users SET ticket_id = $2 WHERE tg_id = $1', [player, id]);
    return true;
  }
}
