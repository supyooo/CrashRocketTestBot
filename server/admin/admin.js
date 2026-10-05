/* Crash Rocket admin panel. Two views: the dashboard and the player card (#p=<id>). Talks to /admin/api/*. */
(() => {
const $ = (s, r = document) => r.querySelector(s);
const root = $('#root');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' TON');
const dt = (t) => (t ? new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const short = (h) => (h && h.length > 16 ? h.slice(0, 8) + '…' + h.slice(-6) : h || '—');
let token = ''; try { token = sessionStorage.getItem('adm.t') || ''; } catch {}
let period = 'today', tab = 'deposits', player = null;

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2400); }
async function api(path, body) {
  const r = await fetch('/admin/api' + path, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { signOut(); throw new Error(j.error || 'not signed in'); }
  if (!r.ok) throw new Error(j.error || 'error ' + r.status);
  return j;
}
function signOut() { token = ''; try { sessionStorage.removeItem('adm.t'); } catch {} login(); }

/* ---------------- sign-in ---------------- */
async function login() {
  const cfg = await fetch('/admin/api/config').then((r) => r.json()).catch(() => ({}));
  root.innerHTML = `<div class="login"><div class="brand" style="font-size:22px">Crash Rocket · Админка</div>
    <p class="muted">Вход только для администраторов из белого списка.</p><div id="tg"></div>
    ${cfg.dev ? '<form id="dev" style="display:flex;gap:8px"><input id="devName" placeholder="Имя (dev-режим)" required><button class="btn">Войти</button></form>' : ''}
    ${!cfg.botUsername && !cfg.dev ? '<p class="err">На сервере не задан BOT_USERNAME: кнопка входа через Telegram недоступна.</p>' : ''}
    <p class="err" id="lerr"></p></div>`;
  window.onTgAuth = (user) => doLogin(user);
  if (cfg.botUsername) {
    const s = document.createElement('script'); s.async = true; s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.dataset.telegramLogin = cfg.botUsername; s.dataset.size = 'large'; s.dataset.onauth = 'onTgAuth(user)'; s.dataset.requestAccess = 'write';
    $('#tg').appendChild(s);
  }
  const f = $('#dev'); if (f) f.onsubmit = (e) => { e.preventDefault(); doLogin({ dev: $('#devName').value.trim() }); };
}
async function doLogin(body) {
  try {
    const r = await fetch('/admin/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'error');
    token = j.token; try { sessionStorage.setItem('adm.t', token); } catch {}
    route();
  } catch (e) { const el = $('#lerr'); if (el) el.textContent = e.message === 'this Telegram account is not an admin' ? 'Этот Telegram-аккаунт не в списке администраторов.' : e.message; }
}

/* ---------------- shell ---------------- */
function shell(inner) {
  root.innerHTML = `<header class="top"><span class="brand"><a href="#" style="color:inherit">Crash Rocket · Админка</a></span>
    <div class="seg" id="per" role="group" aria-label="Период">${[['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']].map(([k, l]) => `<button data-p="${k}" aria-pressed="${period === k}">${l}</button>`).join('')}</div>
    <span class="pill" id="srv"><i class="dot"></i>сервер</span><span class="pill" id="onl">онлайн: —</span>
    <span class="sp"></span>
    <form class="search" id="sf"><input id="sq" placeholder="Поиск игрока: Telegram ID, @username, имя" aria-label="Поиск игрока"><button class="btn">Найти</button></form>
    <button class="btn" id="out">Выйти</button></header><main>${inner}</main>`;
  $('#per').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; period = b.dataset.p; route(); };
  $('#sf').onsubmit = (e) => { e.preventDefault(); const q = $('#sq').value.trim(); if (q) location.hash = 'p=' + encodeURIComponent(q); };
  $('#out').onclick = signOut;
}
function header(s) {
  const srv = $('#srv'); if (srv) srv.innerHTML = `<i class="dot ${s.server.leader ? 'on' : ''}"></i>${s.server.leader ? 'раунд #' + s.server.round + ' · ' + esc(s.server.phase) : 'сервер не ведёт раунды'}`;
  const o = $('#onl'); if (o) o.textContent = 'онлайн: ' + s.online;
}

function route() {
  if (!token) return login();
  const m = location.hash.match(/^#p=(.+)$/);
  if (m) return showPlayer(decodeURIComponent(m[1]));
  return dashboard();
}
window.addEventListener('hashchange', route);

/* ---------------- dashboard ---------------- */
async function dashboard() {
  shell(`<div class="grid">
    <section class="card c8"><h2>Финансовая сводка</h2><div id="fin" class="muted">Загрузка…</div></section>
    <section class="card c4"><h2>Управление кассой</h2><div id="cash" class="muted">Загрузка…</div></section>
    <section class="card c8"><h2>Очередь ручных выводов</h2><div id="queue" class="muted">Загрузка…</div></section>
    <section class="card c4"><h2>Системные алерты</h2><div id="alerts" class="muted">Загрузка…</div></section>
    <section class="card c12"><h2>Итоговая сводка (RevShare)</h2><div id="rev" class="muted">Загрузка…</div></section></div>`);
  const [s, cash, queue, alerts] = await Promise.all([api('/summary?period=' + period), api('/cash'), api('/queue'), api('/alerts')]).catch((e) => { toast(e.message); return []; });
  if (!s) return;
  header(s);
  const kv = (k, v) => `<div class="kv"><span>${k}</span><em>${v}</em></div>`;
  $('#fin').outerHTML = `<div class="kpis">
      <div class="kgrp"><b>Финансы</b>${kv('Сумма депозитов', money(s.deposits))}${kv('Сумма выводов', money(s.withdrawals))}${kv('Бонусы', money(s.bonuses))}</div>
      <div class="kgrp"><b>Прибыль</b>${kv('GGR (грязная)', money(s.ggr))}${kv('NGR (чистая)', money(s.ngr))}${kv('Выплачено выигрышей', money(s.wins))}</div>
      <div class="kgrp"><b>Активность</b>${kv('Оборот ставок', money(s.turnover))}${kv('Активных игроков', s.active)}${kv('ARPU', money(s.arpu))}</div></div>
    <canvas id="chart" aria-label="GGR по времени"></canvas>`;
  drawChart(s.chart);
  $('#cash').outerHTML = `<div class="kgrp"><b>Ликвидность · ${esc(cash.currency)}</b>${kv('Горячий кошелёк', money(cash.hot))}${kv('Холодный кошелёк', 'не подключён')}${kv('Должны игрокам (балансы)', money(cash.owed))}${kv('Выводы в очереди', money(cash.payouts) + ' · ' + cash.payoutsCount)}</div>
    <div class="kgrp"><b>Риски и лимиты</b>${kv('Ставка', money(cash.limits.minBet) + ' – ' + money(cash.limits.maxBet))}${kv('Max win', money(cash.limits.maxWin))}${kv('Ручная проверка выводов от', money(cash.limits.reviewOver))}${kv('Мин. депозит / вывод', money(cash.limits.minDeposit) + ' / ' + money(cash.limits.minWithdraw))}${kv('Вывод в сутки', money(cash.limits.maxWithdrawDay))}</div>
    <p class="muted" style="margin:0;font-size:12.5px">Лимиты меняются переменными сервера на Railway.</p>`;
  $('#queue').outerHTML = queue.length ? `<div class="tbl"><table><thead><tr><th>Заявка</th><th>Игрок</th><th>Сумма</th><th>Вейджер x2</th><th>Создана</th><th>Действия</th></tr></thead><tbody>
    ${queue.map((w) => `<tr><td>#${w.id}</td><td><a href="#p=${encodeURIComponent(w.uid)}">${esc(w.name)}</a><div class="muted mono">${esc(w.tgId ?? w.uid)}</div></td><td><b>${money(w.amount)}</b></td>
      <td>${w.wager.met ? '<span class="chip ok">Да</span>' : '<span class="chip bad">Нет</span>'} <span class="muted">${money(w.wager.done)} / ${money(w.wager.need)}</span></td><td>${dt(w.at)}</td>
      <td style="white-space:nowrap"><button class="btn sm g" data-ap="${w.id}">Одобрить</button> <button class="btn sm r" data-rj="${w.id}">Отклонить</button></td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty">Заявок на проверке нет.</div>';
  const fr = alerts.fraud.map((a) => `<div class="alert"><span class="chip warn">${a.kind === 'ip' ? 'IP' : 'Кошелёк'}</span><span class="t">${a.users.map((u) => `<a href="#p=${encodeURIComponent(u)}">${esc(u)}</a>`).join(', ')}<div class="muted mono">${esc(short(a.key))}</div></span></div>`).join('');
  const un = alerts.unmatched.map((d) => `<div class="alert"><span class="t"><b>${money(d.amount)}</b> от <span class="mono">${esc(short(d.from))}</span><div class="muted">${dt(d.at)} · ${d.status === 'too_small' ? 'меньше минимума' : 'без кода'}${d.comment ? ' · «' + esc(d.comment) + '»' : ''}</div></span><button class="btn sm y" data-at="${esc(d.tx)}">Привязать к ID</button></div>`).join('');
  $('#alerts').outerHTML = `<div><b class="muted" style="font-size:12px">АНТИФРОД: ОБЩИЕ IP И КОШЕЛЬКИ</b><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${fr || '<div class="empty">Совпадений нет.</div>'}</div></div>
    <div><b class="muted" style="font-size:12px">ЗАВИСШИЕ ДЕПОЗИТЫ (БЕЗ КОДА)</b><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${un || '<div class="empty">Нет.</div>'}</div></div>`;
  $('#rev').outerHTML = `<div class="kpis">${kv('NGR за период', money(s.ngr))}${kv('Партнёрская доля (' + Math.round(s.revshare.share * 100) + '%)', money(s.revshare.partner))}${kv('Net income проекта', money(s.revshare.net))}</div>`;
  root.querySelector('main').onclick = async (e) => {
    const ap = e.target.closest('[data-ap]'), rj = e.target.closest('[data-rj]'), at = e.target.closest('[data-at]');
    try {
      if (ap) { if (!confirm('Одобрить вывод #' + ap.dataset.ap + '?')) return; await api('/withdrawals/approve', { id: +ap.dataset.ap }); toast('Вывод одобрен, ушёл в очередь на отправку'); dashboard(); }
      else if (rj) { const reason = prompt('Причина отказа (её увидят в журнале):'); if (!reason) return; await api('/withdrawals/reject', { id: +rj.dataset.rj, reason }); toast('Вывод отклонён, сумма вернулась на баланс игрока'); dashboard(); }
      else if (at) { const uid = prompt('Telegram ID или ID игрока, которому зачислить депозит:'); if (!uid) return; const r = await api('/deposits/attach', { tx: at.dataset.at, uid }); toast('Депозит зачислен игроку ' + r.uid); dashboard(); }
    } catch (err) { toast(err.message); }
  };
}

function drawChart(points) {
  const cv = $('#chart'); if (!cv) return;
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d;
  const c = cv.getContext('2d'); c.scale(d, d); const w = r.width, h = r.height, pad = 22;
  c.font = '11px system-ui'; c.fillStyle = '#9a97c4';
  if (!points.length) { c.fillText('Нет ставок за период', pad, h / 2); return; }
  const max = Math.max(...points.map((p) => Math.abs(p.ggr)), 0.01), mid = h / 2, bw = Math.max(2, (w - pad) / points.length - 3);
  c.strokeStyle = '#2f2a5c'; c.beginPath(); c.moveTo(pad, mid); c.lineTo(w, mid); c.stroke();
  c.fillText('GGR', 0, 12);
  points.forEach((p, i) => { const x = pad + i * ((w - pad) / points.length), bh = (Math.abs(p.ggr) / max) * (mid - 8);
    c.fillStyle = p.ggr >= 0 ? '#2bff88' : '#ff4d6d'; c.fillRect(x, p.ggr >= 0 ? mid - bh : mid, bw, bh); });
}

/* ---------------- player card ---------------- */
const ST = { credited: ['зачислен', 'ok'], attached: ['привязан вручную', 'ok'], unmatched: ['без кода', 'warn'], too_small: ['меньше минимума', 'warn'],
  review: ['на проверке', 'warn'], pending: ['в очереди', 'info'], sending: ['отправляется', 'info'], sent: ['успешен', 'ok'], failed: ['не прошёл, возврат', 'bad'], rejected: ['отклонён', 'bad'],
  win: ['выигрыш', 'ok'], lose: ['проигрыш', 'bad'], refunded: ['возврат', 'info'] };
const chip = (s) => { const [l, k] = ST[s] || [s, '']; return `<span class="chip ${k}">${esc(l)}</span>`; };
const ACT = { approve: 'Одобрен вывод', reject: 'Отклонён вывод', attach: 'Привязан депозит', block: 'Заблокирован', unblock: 'Разблокирован', freeze: 'Заморожен баланс', unfreeze: 'Разморожен баланс', adjust: 'Ручное изменение баланса', note: 'Заметка', refund_bet: 'Возврат ставки' };

async function showPlayer(q) {
  shell('<div class="muted">Загрузка…</div>');
  api('/summary?period=' + period).then(header).catch(() => {});
  try { player = await api('/player?q=' + encodeURIComponent(q)); } catch (e) { root.querySelector('main').innerHTML = `<p class="err">${esc(e.message === 'no player found' ? 'Игрок не найден.' : e.message)}</p>`; return; }
  const p = player, st = (k, v) => `<div class="stat"><span>${k}</span><b>${v}</b></div>`;
  root.querySelector('main').innerHTML = `<div class="grid">
    <section class="card c8">
      <div class="who"><div class="ava">${esc((p.name || '?').replace('@', '').slice(0, 1).toUpperCase())}</div>
        <div style="flex:1;min-width:0"><h1>${esc(p.name)} ${p.blocked ? '<span class="chip bad">заблокирован</span>' : ''} ${p.frozen ? '<span class="chip warn">баланс заморожен</span>' : ''}</h1>
          <div class="muted">Telegram ID: <span class="mono">${esc(p.tgId ?? '—')}</span> · ID: <span class="mono">${esc(p.uid)}</span>${p.username ? ' · @' + esc(p.username) : ''}</div>
          <div class="muted">Дата регистрации: ${dt(p.createdAt)} · Реферал: ${p.refBy ? esc(p.refBy) : 'нет'}</div></div></div>
      <div class="acts">
        <button class="btn ${p.blocked ? 'g' : 'r'}" data-a="${p.blocked ? 'unblock' : 'block'}">${p.blocked ? 'Разблокировать' : 'Заблокировать'}</button>
        <button class="btn y" data-a="${p.frozen ? 'unfreeze' : 'freeze'}">${p.frozen ? 'Разморозить баланс' : 'Заморозить баланс'}</button>
        <button class="btn" data-a="adjust">Начислить / списать</button><button class="btn" data-a="note">Заметка</button></div>
      <div class="stats">
        ${st('Баланс', money(p.balance))}${st('Сумма депозитов', money(p.deposits))}${st('Сумма выводов', money(p.withdrawals))}${st('Отыгрыш x2', p.wager.need ? `${money(p.wager.done)} / ${money(p.wager.need)} ${p.wager.met ? '<span class="chip ok">выполнен</span>' : '<span class="chip warn">нет</span>'}` : '—')}
        ${st('Сумма выигрыша', money(p.wins))}${st('Сумма проигрыша', money(p.losses))}${st('Доход казино', money(p.income))}${st('Оборот', money(p.turnover) + ` <span class="muted" style="font-size:12px">${p.betsCount} ставок</span>`)}
        ${st('Сумма бонусов', money(p.bonuses))}${st('Доля партнёра', money(p.partner))}${st('Статус вывода', p.blocked || p.frozen ? '<span class="chip bad">запрещён</span>' : '<span class="chip ok">разрешён</span>')}${st('Код пополнения', `<span class="mono">${esc(p.depositCode ?? '—')}</span>`)}
      </div>
      <div class="muted" style="font-size:12.5px">IP: ${p.ips.length ? p.ips.map((i) => `<span class="mono">${esc(i.ip)}</span>`).join(', ') : '—'} · Кошельки: ${p.wallets.length ? p.wallets.map((a) => `<span class="mono">${esc(short(a))}</span>`).join(', ') : '—'}</div>
      <div class="tabs" id="tabs">${[['deposits', 'История депозитов'], ['withdrawals', 'История выводов'], ['bets', 'История ставок'], ['bonuses', 'История бонусов']].map(([k, l]) => `<button data-t="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
      <div class="tbl" id="list"></div></section>
    <section class="card c4"><h2>Взаимодействия с игроком</h2>
      <div class="log">${p.log.length ? p.log.map((l) => `<div class="li"><b>${esc(ACT[l.action] || l.action)}</b>${logDetail(l)}<small>${dt(l.at)} · ${esc(l.admin)}</small></div>`).join('') : '<div class="empty">Пока ничего. Здесь появятся действия админов и заметки.</div>'}</div></section></div>`;
  renderList();
  const main = root.querySelector('main');
  main.onclick = async (e) => {
    const t = e.target.closest('[data-t]'); if (t) { tab = t.dataset.t; main.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-pressed', b === t)); renderList(); return; }
    const a = e.target.closest('[data-a]'), rb = e.target.closest('[data-rb]');
    try {
      if (rb) { const reason = prompt('Причина возврата ставки:'); if (!reason) return; await api('/player/action', { uid: p.uid, action: 'refund_bet', ref: rb.dataset.rb, reason }); toast('Ставка возвращена'); return showPlayer(p.uid); }
      if (!a) return;
      const act = a.dataset.a, body = { uid: p.uid, action: act };
      if (act === 'adjust') { const v = prompt('Сумма в TON: положительная начисляет, отрицательная списывает'); if (!v) return; body.amount = Number(v.replace(',', '.')); body.reason = prompt('Причина (обязательно):') || ''; if (!body.reason) return; }
      else if (act === 'note') { body.text = prompt('Текст заметки:') || ''; if (!body.text) return; }
      else { const r = prompt('Причина (для журнала):'); if (r === null) return; body.reason = r; }
      await api('/player/action', body); toast('Готово'); showPlayer(p.uid);
    } catch (err) { toast(err.message); }
  };
}
function logDetail(l) {
  const d = l.data || {}, parts = [];
  if (d.amount !== undefined) parts.push(money(d.amount));
  if (d.withdrawal) parts.push('заявка #' + d.withdrawal);
  if (d.tx) parts.push('tx ' + short(d.tx));
  if (d.bet) parts.push(short(d.bet));
  if (d.reason) parts.push('«' + d.reason + '»');
  if (d.text) parts.push(d.text);
  return parts.length ? `<div>${esc(parts.join(' · '))}</div>` : '';
}
function renderList() {
  const p = player, L = p.lists[tab], el = $('#list');
  if (!L.length) { el.innerHTML = '<div class="empty">Записей нет.</div>'; return; }
  const H = {
    deposits: ['Время', 'Сумма', 'Статус', 'Мерчант / провайдер', 'Хэш транзакции'],
    withdrawals: ['Время', 'Сумма', 'Статус', 'Мерчант / провайдер', 'Куда / seqno', ''],
    bets: ['Время', 'Ставка', 'Выигрыш / проигрыш', 'Раунд', 'Хэш раунда / ставки', ''],
    bonuses: ['Время', 'Сумма', 'Тип', 'Код']
  }[tab];
  const row = {
    deposits: (d) => [dt(d.at), money(d.amount), chip(d.status), esc(d.provider), `<span class="mono" title="${esc(d.tx)}">${esc(short(d.tx))}</span>`],
    withdrawals: (w) => [dt(w.at), money(w.amount), chip(w.status) + (w.error ? `<div class="muted">${esc(w.error)}</div>` : ''), esc(w.provider), `<span class="mono">${esc(short(w.to))}</span>${w.seqno !== null ? ' · ' + w.seqno : ''}`,
      w.status === 'review' ? `<button class="btn sm g" data-ap="${w.id}">Одобрить</button>` : ''],
    bets: (b) => [dt(b.at), money(b.stake), chip(b.result) + (b.result === 'win' ? ' ' + money(b.payout) : b.result === 'lose' ? ' −' + money(b.stake) : ''), `#${b.round}${b.crash ? ' · ' + b.crash.toFixed(2) + 'x' : ''}`,
      `<span class="mono" title="${esc(b.roundHash)}">${esc(short(b.roundHash))}</span><div class="muted mono">${esc(b.ref)}</div>`, b.result === 'lose' ? `<button class="btn sm" data-rb="${esc(b.ref)}">Вернуть</button>` : ''],
    bonuses: (g) => [dt(g.at), money(g.amount), g.type === 'grant' ? 'стартовый / пополнение демо' : 'ручное начисление', `<span class="mono">${esc(g.code)}</span>`]
  }[tab];
  el.innerHTML = `<table><thead><tr>${H.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${L.map((x) => `<tr>${row(x).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  el.onclick = async (e) => { const ap = e.target.closest('[data-ap]'); if (!ap) return; e.stopPropagation(); try { if (!confirm('Одобрить вывод?')) return; await api('/withdrawals/approve', { id: +ap.dataset.ap }); toast('Вывод одобрен'); showPlayer(p.uid); } catch (err) { toast(err.message); } };
}

route();
})();
