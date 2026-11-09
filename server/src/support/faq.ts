/**
 * The support bot's FAQ tree, from the support model (docs/support-model.md). Texts are the model's answers;
 * the currency is TON (the model says USDT) and every limit comes from the server config, so the answers
 * never disagree with the game.
 *
 * A node is either a section (title + kids: a menu) or an answer (title + text, maybe kids: buttons under it).
 * `ask`: after this answer the bot waits for the player's message and passes it to the operators as a ticket
 * (the red "Нам в чат приходит" boxes of the model).
 * Texts are Telegram HTML: only <b>, <i>, <a>; everything else must be escaped.
 */
import type { Config } from '../config.js';
import { fromUnits } from '../config.js';

export type Lang = 'ru' | 'en';
export type L10n = Record<Lang, string>;
export type FaqNode = { id: string; title: L10n; text?: L10n; kids?: string[]; ask?: boolean };

export const ROOT = 'root';

/** Values the answers quote. */
export function faqParams(cfg: Config) {
  const n = (u: number) => String(fromUnits(u));
  return {
    minBet: fromUnits(cfg.minBet).toFixed(2), maxBet: n(cfg.maxBet), maxWin: n(cfg.maxWin), rtp: String(100 - cfg.edgeBps / 100),
    minDeposit: n(cfg.ton.minDeposit), minWithdraw: n(cfg.ton.minWithdraw), reviewOver: n(cfg.admin.reviewOver),
    email: cfg.support.partnerEmail
  };
}
type P = ReturnType<typeof faqParams>;

const DOCS_RU = `• Фото документа, удостоверяющего личность (паспорт или ID-карта).
• Селфи, на котором чётко видно ваше лицо, документ и лист бумаги с написанным от руки кодовым словом <b>«notrock»</b>, вашим Telegram ID и сегодняшней датой.
• Скриншот из кошелька или биржи, с которого производилось первоначальное пополнение баланса игры (должен быть виден хэш/TXID транзакции).`;
const DOCS_EN = `• A photo of an identity document (passport or ID card).
• A selfie clearly showing your face, the document and a sheet of paper with the code word <b>"notrock"</b> handwritten on it, your Telegram ID and today's date.
• A screenshot from the wallet or exchange you made your first deposit from (the transaction hash/TXID must be visible).`;
const ASK_RU = 'Уточните, пожалуйста, несколько моментов, чтобы мы могли проверить информацию:';
const ASK_EN = 'Please tell us a few details so we can check:';
const ONE_MSG_RU = 'Пожалуйста, отправьте всё одним сообщением ниже.';
const ONE_MSG_EN = 'Please send everything in one message below.';
const CHANNEL_RU = 'в нашем официальном Telegram-канале';
const CHANNEL_EN = 'in our official Telegram channel';

export function buildFaq(p: P): Map<string, FaqNode> {
  const nodes: FaqNode[] = [
    { id: ROOT, title: { ru: 'Поддержка Boomy', en: 'Boomy support' },
      text: { ru: 'Выберите раздел, и мы подскажем ответ. Если готовый ответ не поможет, бот передаст обращение оператору.',
              en: 'Pick a topic and we will find the answer. If a ready answer does not help, the bot will pass your request to an operator.' },
      kids: ['dep', 'wd', 'game', 'bonus', 'ref', 'sec', 'partners'] },

    // ---------- deposits ----------
    { id: 'dep', title: { ru: 'Пополнение', en: 'Deposits' }, kids: ['dep_how', 'dep_miss'] },
    { id: 'dep_how', title: { ru: 'Как пополнить баланс?', en: 'How do I top up?' },
      text: { ru: `Для пополнения баланса:
• Перейдите в раздел «Профиль» в нижней части экрана.
• В верхней части экрана нажмите кнопку «Пополнить».
• Выберите предпочитаемую криптовалюту и сеть, затем укажите сумму пополнения.
• Следуйте инструкциям на экране для завершения платежа.
Минимальная сумма пополнения — ${p.minDeposit} TON.`,
              en: `To top up your balance:
• Open "Profile" at the bottom of the screen.
• Tap "Deposit" at the top of the screen.
• Choose the cryptocurrency and network you prefer, then enter the amount.
• Follow the on-screen instructions to complete the payment.
The minimum deposit is ${p.minDeposit} TON.` } },
    { id: 'dep_miss', title: { ru: 'Не пришёл депозит', en: 'My deposit has not arrived' }, ask: true,
      text: { ru: `Депозиты обрабатываются автоматически через независимый криптошлюз. Обычно зачисление занимает несколько минут после подтверждения сети.
<b>Важно:</b>
• Убедитесь, что вы отправили средства точно в той сети, которую выбрали при создании заявки.
• Проверьте статус транзакции в блокчейне (TXID).

Если транзакция подтверждена сетью, но средства не поступили на баланс в течение 30 минут, пожалуйста, пришлите данную информацию:
• Выбранная криптовалюта, сеть и точная сумма перевода.
• Ссылка на транзакцию в обозревателе блокчейна (или её хэш/TXID).
• Скриншот успешного перевода из вашего кошелька.`,
              en: `Deposits are processed automatically by an independent crypto gateway. Crediting usually takes a few minutes after the network confirms the transfer.
<b>Important:</b>
• Make sure you sent the funds on exactly the network you chose when creating the request.
• Check the transaction status on the blockchain (TXID).

If the network has confirmed the transaction but the funds have not reached your balance within 30 minutes, please send us:
• The cryptocurrency, network and exact amount sent.
• A link to the transaction in a blockchain explorer (or its hash/TXID).
• A screenshot of the successful transfer from your wallet.` } },

    // ---------- withdrawals ----------
    { id: 'wd', title: { ru: 'Вывод', en: 'Withdrawals' }, kids: ['wd_how', 'wd_time', 'wd_cancel', 'wd_miss', 'wd_off'] },
    { id: 'wd_how', title: { ru: 'Как сделать вывод?', en: 'How do I withdraw?' },
      text: { ru: `Для вывода средств:
• Перейдите в раздел «Профиль» в нижней части экрана.
• Нажмите на кнопку «Вывести».
• Выберите сумму вывода.
Минимальная сумма вывода — ${p.minWithdraw} TON. Комиссии с нашей стороны отсутствуют.
<b>Обратите внимание:</b> функция вывода становится доступна только после выполнения условия обязательного оборота (вейджер ×2) от суммы ваших депозитов.`,
              en: `To withdraw:
• Open "Profile" at the bottom of the screen.
• Tap "Withdraw".
• Choose the amount.
The minimum withdrawal is ${p.minWithdraw} TON. We charge no fees.
<b>Please note:</b> withdrawals become available only after the required turnover (wager ×2) of your deposits is met.` } },
    { id: 'wd_time', title: { ru: 'Сроки вывода', en: 'Withdrawal times' }, kids: ['wd_late'],
      text: { ru: `Вывод средств до ${p.reviewOver} TON обрабатывается автоматически. Заявки свыше ${p.reviewOver} TON проходят ручную проверку службой безопасности. Стандартный срок обработки таких заявок составляет до 48 рабочих часов.
Если <b>по истечении этого срока</b> вывод не поступил, пожалуйста, нажмите на кнопку «Сроки вывода прошли».`,
              en: `Withdrawals up to ${p.reviewOver} TON are processed automatically. Requests above ${p.reviewOver} TON are reviewed by the security team by hand. The standard processing time for them is up to 48 business hours.
If the withdrawal has not arrived <b>after that time</b>, please tap "Withdrawal time has passed".` } },
    { id: 'wd_late', title: { ru: 'Сроки вывода прошли', en: 'Withdrawal time has passed' }, ask: true,
      text: { ru: `Опишите, пожалуйста, ситуацию: сумма и дата заявки на вывод, адрес кошелька. ${ONE_MSG_RU}`,
              en: `Please describe the situation: the amount and date of the withdrawal request and the wallet address. ${ONE_MSG_EN}` } },
    { id: 'wd_cancel', title: { ru: 'Как отменить вывод?', en: 'How do I cancel a withdrawal?' },
      text: { ru: `Вы можете отменить заявку на вывод до момента её подтверждения Администрацией.
Для отмены:
• Перейдите в раздел «Профиль».
• Нажмите на раздел «Детализация».
• Найдите вашу заявку со статусом «В ожидании» и нажмите крестик («✕») рядом с ней. Средства мгновенно вернутся на ваш игровой баланс.`,
              en: `You can cancel a withdrawal request until the Administration confirms it.
To cancel:
• Open "Profile".
• Tap "Transactions".
• Find your request with the "Pending" status and tap the cross ("✕") next to it. The funds return to your game balance at once.` } },
    { id: 'wd_miss', title: { ru: 'Вывод не поступил', en: 'My withdrawal has not arrived' }, kids: ['wd_late'],
      text: { ru: `Вывод средств до ${p.reviewOver} TON обрабатывается автоматически. Заявки свыше ${p.reviewOver} TON проходят ручную проверку службой безопасности. Стандартный срок обработки таких заявок составляет до 48 рабочих часов.
Если <b>по истечении этого срока</b> вывод не поступил, пожалуйста, нажмите на кнопку «Сроки вывода прошли».`,
              en: `Withdrawals up to ${p.reviewOver} TON are processed automatically. Requests above ${p.reviewOver} TON are reviewed by the security team by hand. The standard processing time for them is up to 48 business hours.
If the withdrawal has not arrived <b>after that time</b>, please tap "Withdrawal time has passed".` } },
    { id: 'wd_off', title: { ru: 'Вывод отменён', en: 'My withdrawal was cancelled' }, ask: true,
      text: { ru: `Ваша заявка на вывод была отменена, а аккаунт временно ограничен в рамках стандартной проверки службы безопасности (AML-политика). Для снятия ограничений нам необходимо убедиться, что аккаунтом владеете именно вы.

Для проверки предоставьте, пожалуйста, следующую информацию:
${DOCS_RU}
Документы обрабатываются уполномоченными сотрудниками и хранятся в зашифрованном виде согласно Политике конфиденциальности. ${ONE_MSG_RU}`,
              en: `Your withdrawal request was cancelled and the account is temporarily restricted as part of a standard security review (AML policy). To lift the restrictions we need to make sure that you are the owner of the account.

Please provide:
${DOCS_EN}
Documents are handled by authorised staff and stored encrypted under the Privacy Policy. ${ONE_MSG_EN}` } },

    // ---------- the game ----------
    { id: 'game', title: { ru: 'Игра', en: 'The game' }, kids: ['g_bet', 'g_fair', 'g_err', 'g_lim'] },
    { id: 'g_bet', title: { ru: 'Как сделать ставку?', en: 'How do I bet?' },
      text: { ru: `1. Введите желаемую сумму и нажмите кнопку «Ставка».
2. Нет необходимости ограничивать себя только одной ставкой. Вы можете делать две ставки одновременно, используя вторую панель.
3. Чтобы выиграть, вам нужно нажать кнопку «Забрать» <b>до того, как ракета взорвётся</b>. Ваш выигрыш — это сумма ставки, умноженная на множитель в момент нажатия кнопки.
4. Если ракета взрывается до того, как вы вывели средства, ставка считается проигранной.`,
              en: `1. Enter the amount you want and tap "Bet".
2. One bet is not the limit. You can place two bets at once using the second panel.
3. To win, tap "Cash out" <b>before the rocket explodes</b>. Your win is your bet times the multiplier at the moment you tap.
4. If the rocket explodes before you cash out, the bet is lost.` } },
    { id: 'g_fair', title: { ru: 'Как проверить честность?', en: 'How do I check fairness?' },
      text: { ru: `Результаты всех раундов генерируются до их начала с использованием криптографической цепочки SHA-256. Исход невозможно изменить задним числом.
Для проверки раунда:
• Откройте окно детальной информации о раунде в «Истории коэффициентов».
• Скопируйте «Хэш раунда» (Server Seed) и «Соль» (Client Seed).
• Вы можете проверить результат с помощью встроенного в игру автоматического верификатора или использовать независимые калькуляторы. Точный алгоритм расчёта доступен в правилах Платформы.`,
              en: `The results of all rounds are generated before they start using a SHA-256 cryptographic chain. No result can be changed afterwards.
To check a round:
• Open the round details from the "Multiplier history".
• Copy the "Round hash" (Server Seed) and the "Salt" (Client Seed).
• Check the result with the game's built-in verifier or any independent calculator. The exact algorithm is in the Platform rules.` } },
    { id: 'g_err', title: { ru: 'Ошибка в игре', en: 'Game error' }, kids: ['g_crash', 'g_net'] },
    { id: 'g_crash', title: { ru: 'Сбой во время ставки', en: 'Something failed during a bet' }, kids: ['g_norefund'],
      text: { ru: `В случае критической ошибки на стороне серверов Платформы система автоматически инициирует возврат (Refund) вашей активной ставки на баланс. Обычно это происходит в течение нескольких минут.
Если произошёл сбой, но возврат не поступил, пожалуйста, нажмите кнопку «Возврата не было».`,
              en: `If a critical error happens on the Platform's servers, the system automatically refunds your active bet to your balance. This usually takes a few minutes.
If something failed and the refund did not arrive, please tap "There was no refund".` } },
    { id: 'g_norefund', title: { ru: 'Возврата не было', en: 'There was no refund' }, ask: true,
      text: { ru: `${ASK_RU}

• Сумма и время ставки по часовому поясу (<b>UTC+0</b>)
• Скриншот ошибки (по возможности)
• Подробное описание ошибки и ситуации, с которой вы столкнулись.`,
              en: `${ASK_EN}

• The amount and time of the bet (<b>UTC+0</b>)
• A screenshot of the error (if you can)
• A detailed description of the error and what happened.` } },
    { id: 'g_net', title: { ru: 'Пропал интернет', en: 'My internet dropped' },
      text: { ru: `Все раунды рассчитываются на наших серверах в реальном времени. Если у вас пропал интернет, завис телефон или случайно закрылся Telegram, сам полёт ракеты не останавливается. Если вы не успели нажать «Забрать», а функция «Автовывод» не была настроена, ставка сгорит в момент краша. Если же вы заранее установили множитель в поле «Автовывод», система автоматически зафиксирует вашу прибыль даже при полном отключении от сети. Пожалуйста, используйте автовывод для подстраховки при слабом интернете!`,
              en: `All rounds are calculated on our servers in real time. If your internet drops, your phone freezes or Telegram closes by accident, the flight does not stop. If you did not tap "Cash out" and had no auto cash-out set, the bet is lost at the crash. If you set a multiplier in "Auto cash-out" beforehand, the system locks in your win even if you are completely offline. Please use auto cash-out as a safety net on a weak connection!` } },
    { id: 'g_lim', title: { ru: 'Лимиты ставок', en: 'Bet limits' },
      text: { ru: `Лимиты игры на данный момент:
• <b>Минимальная ставка:</b> ${p.minBet} TON
• <b>Максимальная ставка:</b> ${p.maxBet} TON на одну панель
• <b>Максимальная выплата (Max Win):</b> ${p.maxWin} TON с одной ставки (включает сумму вашей ставки и чистый выигрыш). При достижении этой суммы система автоматически зафиксирует победу.
Процент возврата игроку (RTP) составляет ${p.rtp}%. Это математическое ожидание возврата средств на длинной дистанции.`,
              en: `Current limits:
• <b>Minimum bet:</b> ${p.minBet} TON
• <b>Maximum bet:</b> ${p.maxBet} TON per panel
• <b>Maximum payout (Max Win):</b> ${p.maxWin} TON per bet (your stake plus the net win). When a bet reaches it, the system locks in the win automatically.
The return to player (RTP) is ${p.rtp}%. It is the expected return over the long run.` } },

    // ---------- security, bans and AML ----------
    { id: 'sec', title: { ru: 'Безопасность, блокировки и AML', en: 'Security, bans and AML' }, kids: ['s_frz', 's_ban', 's_age'] },
    { id: 's_frz', title: { ru: 'Заморозка средств и AML-проверка', en: 'Frozen funds and AML review' }, kids: ['s_why', 's_unfrz'] },
    { id: 's_why', title: { ru: 'Почему мой баланс заморожен?', en: 'Why is my balance frozen?' },
      text: { ru: 'В соответствии с международной политикой противодействия отмыванию денег (AML) и правилами безопасности платформы, входящие транзакции с высоким уровнем риска (например, связанные с миксерами, даркнетом или подсанкционными кошельками) или попытки транзитных переводов влекут за собой бессрочную заморозку баланса до прохождения углублённой верификации личности (KYC).',
              en: 'Under the international anti-money-laundering (AML) policy and the platform\'s security rules, high-risk incoming transactions (for example, linked to mixers, the darknet or sanctioned wallets) or attempts at transit transfers freeze the balance indefinitely until an in-depth identity verification (KYC) is passed.' } },
    { id: 's_unfrz', title: { ru: 'Как разморозить средства?', en: 'How do I unfreeze my funds?' }, ask: true,
      text: { ru: `Для проведения ручной проверки службой безопасности и снятия ограничений, пожалуйста, предоставьте:
${DOCS_RU}
Документы обрабатываются уполномоченными сотрудниками и хранятся в зашифрованном виде согласно Политике конфиденциальности. Пожалуйста, отправьте файлы одним сообщением.`,
              en: `For a manual review by the security team and lifting the restrictions, please provide:
${DOCS_EN}
Documents are handled by authorised staff and stored encrypted under the Privacy Policy. Please send the files in one message.` } },
    { id: 's_ban', title: { ru: 'Блокировка аккаунта (мультиаккаунтинг и фермы)', en: 'Account ban (multi-accounting and farms)' }, kids: ['s_banwhy', 's_appeal'] },
    { id: 's_banwhy', title: { ru: 'За что заблокировали мой аккаунт?', en: 'Why was my account banned?' }, kids: ['s_appeal'],
      text: { ru: `Ваш аккаунт заблокирован системой безопасности за нарушение Правил Платформы (использование ботов, ферм аккаунтов, эксплуатация уязвимостей или мультиаккаунтинг для сбора бонусов).
Согласно пункту 5.5 Пользовательского соглашения, связанные аккаунты блокируются без права восстановления. Решения автоматической системы являются окончательными.
Если вы уверены, что произошла критическая техническая ошибка, выберите опцию «Мой аккаунт заблокировали по ошибке» для ручной апелляции.`,
              en: `Your account was banned by the security system for breaking the Platform Rules (bots, account farms, exploiting vulnerabilities or multi-accounting to collect bonuses).
Under section 5.5 of the User Agreement, linked accounts are banned without the right to restore them. Decisions of the automated system are final.
If you are sure a critical technical error happened, choose "My account was banned by mistake" for a manual appeal.` } },
    { id: 's_appeal', title: { ru: 'Мой аккаунт заблокировали по ошибке', en: 'My account was banned by mistake' }, ask: true,
      text: { ru: `Для проведения ручной проверки службой безопасности и снятия ограничений, пожалуйста, предоставьте:
${DOCS_RU}
Документы обрабатываются уполномоченными сотрудниками и хранятся в зашифрованном виде согласно Политике конфиденциальности. Пожалуйста, отправьте файлы одним сообщением.`,
              en: `For a manual review by the security team and lifting the restrictions, please provide:
${DOCS_EN}
Documents are handled by authorised staff and stored encrypted under the Privacy Policy. Please send the files in one message.` } },
    { id: 's_age', title: { ru: 'Возрастные ограничения', en: 'Age restrictions' },
      text: { ru: 'Услуги платформы доступны исключительно лицам, достигшим 18-летнего возраста (или совершеннолетия в соответствии с законодательством вашей юрисдикции). В случае выявления несовершеннолетних пользователей аккаунт подлежит перманентной блокировке с аннулированием игрового баланса.',
              en: 'The platform is available only to people aged 18 or over (or the age of majority in your jurisdiction). Accounts of minors are banned permanently and their game balance is voided.' } },

    // ---------- referral programme ----------
    { id: 'ref', title: { ru: 'Реферальная программа', en: 'Referral programme' }, kids: ['r_how', 'r_link', 'r_out', 'r_prob'] },
    { id: 'r_how', title: { ru: 'Как это работает?', en: 'How does it work?' },
      text: { ru: `Приглашайте друзей и зарабатывайте вместе с нами! Вы получаете от 5% до 15% от прибыли платформы в зависимости от оборота ваших друзей. Все начисления происходят автоматически.

<i>Важно: бонус рассчитывается именно с прибыли системы (когда ваш друг совершает ставки), а не с суммы его пополнения.</i>`,
              en: `Invite friends and earn with us! You get 5% to 15% of the platform's profit depending on your friends' turnover. Everything is credited automatically.

<i>Important: the bonus is calculated from the platform's profit (when your friend places bets), not from the amount they deposit.</i>` } },
    { id: 'r_link', title: { ru: 'Где найти мою ссылку?', en: 'Where is my link?' },
      text: { ru: `Ваша уникальная пригласительная ссылка находится в WebApp.
• Перейдите в раздел «Профиль» в нижнем меню.
• Нажмите «Копировать» или «Поделиться».
• Отправьте её другу — как только он запустит бота по вашей ссылке, он навсегда закрепится за вами!`,
              en: `Your personal invite link is in the WebApp.
• Open "Profile" in the bottom menu.
• Tap "Copy" or "Share".
• Send it to a friend: as soon as they start the bot from your link, they are linked to you for good!` } },
    { id: 'r_out', title: { ru: 'Как вывести бонусы?', en: 'How do I withdraw the bonuses?' },
      text: { ru: 'Все реферальные начисления автоматически попадают на ваш основной игровой баланс. Вы можете использовать их для дальнейшей игры или вывести на свой кошелёк в любой момент через стандартный раздел «Вывод» (при соблюдении минимальной суммы вывода).',
              en: 'All referral earnings go to your main game balance automatically. You can keep playing with them or withdraw them to your wallet at any time through the usual "Withdraw" section (above the minimum withdrawal).' } },
    { id: 'r_prob', title: { ru: 'Проблема с рефералом', en: 'A problem with a referral' }, kids: ['r_nobonus', 'r_nofriend'] },
    { id: 'r_nobonus', title: { ru: 'Друг зарегистрировался, но бонусов нет', en: 'My friend joined but I got no bonus' },
      text: { ru: 'Помните, что вы получаете от 5% именно с прибыли платформы. Если ваш друг только пополнил баланс, но ещё не играл, или если он находится в плюсе (выигрывает), прибыль платформы равна нулю, и бонус пока не начисляется. Как только статистика обновится, бонус поступит на баланс.',
              en: 'Remember that you get from 5% of the platform\'s profit. If your friend has only deposited and not played yet, or is in profit (winning), the platform\'s profit is zero and no bonus is credited yet. As soon as the stats update, the bonus reaches your balance.' } },
    { id: 'r_nofriend', title: { ru: 'Не вижу друга в статистике', en: 'My friend is not in my stats' }, ask: true,
      text: { ru: `Такое случается, если друг запустил бота до того, как перешёл по вашей ссылке, либо использовал чужую. Мы можем проверить это вручную, но для этого понадобится @username вашего друга в Telegram. ${ONE_MSG_RU}`,
              en: `This happens when a friend started the bot before opening your link, or used someone else's. We can check it by hand, but we need your friend's Telegram @username. ${ONE_MSG_EN}` } },

    // ---------- bonuses ----------
    { id: 'bonus', title: { ru: 'Бонусы', en: 'Bonuses' }, kids: ['b_wel', 'b_hng', 'b_vch', 'b_tsk'] },
    { id: 'b_wel', title: { ru: 'Приветственный бонус 500%', en: 'Welcome bonus 500%' }, kids: ['b_how', 'b_miss'] },
    { id: 'b_how', title: { ru: 'Как работает бонус на депозит?', en: 'How does the deposit bonus work?' }, kids: ['b_ask'],
      text: { ru: 'За первые 4 пополнения вы получаете от 50% до 200% на Бонусный счёт в виде виртуальных Монет (например, при первом депозите на 10 TON вы получите 200 Монет). <b>Важно:</b> Монеты не подлежат выводу в криптовалюту.',
              en: 'For your first 4 deposits you get 50% to 200% on the Bonus account as virtual Coins (for example, a first deposit of 10 TON gives 200 Coins). <b>Important:</b> Coins cannot be withdrawn as cryptocurrency.' } },
    { id: 'b_miss', title: { ru: 'Депозит сделал, а бонус не пришёл', en: 'I deposited but got no bonus' }, kids: ['b_ask'],
      text: { ru: 'Бонусные Монеты начисляются автоматически. Проверьте ваш Бонусный баланс в разделе «Ангар». Если Монет нет, убедитесь, что это один из ваших первых четырёх депозитов. Если проблема сохраняется, нажмите кнопку ниже.',
              en: 'Bonus Coins are credited automatically. Check your Bonus balance in the "Hangar". If there are no Coins, make sure it was one of your first four deposits. If the problem persists, tap the button below.' } },
    { id: 'b_ask', title: { ru: 'Бонус так и не пришёл', en: 'The bonus still has not arrived' }, ask: true,
      text: { ru: `${ASK_RU}

• Скриншот пополнения
• Скриншот из раздела «Детализация» с депозитом, по которому не пришёл бонус
• Подробное описание ошибки и ситуации, с которой вы столкнулись.`,
              en: `${ASK_EN}

• A screenshot of the deposit
• A screenshot from "Transactions" with the deposit that brought no bonus
• A detailed description of the error and what happened.` } },
    { id: 'b_hng', title: { ru: 'Ангар, скины и кэшбек', en: 'Hangar, skins and cashback' }, kids: ['h_why', 'h_cb', 'h_dup'] },
    { id: 'h_why', title: { ru: 'Для чего нужны Монеты и Скины?', en: 'What are Coins and Skins for?' },
      text: { ru: 'Монеты — это виртуальная валюта, которую нельзя вывести в TON. Они используются для покупки Кейсов со Скинами в Ангаре. Скины меняют визуал игры, а редкие предметы (Эпические и Легендарные) дают пассивные бонусы — например, ускоряют заработок Монет. На шанс выигрыша реальных денег скины не влияют.',
              en: 'Coins are a virtual currency that cannot be withdrawn as TON. They buy Cases with Skins in the Hangar. Skins change how the game looks, and rare items (Epic and Legendary) give passive bonuses, such as earning Coins faster. Skins do not change your chance to win real money.' } },
    { id: 'h_cb', title: { ru: 'Не пришёл кэшбек (Монеты) за ставки', en: 'No cashback (Coins) for my bets' },
      text: { ru: 'Кэшбек в виде Монет начисляется автоматически только за ставки с Реального баланса (TON). Ставки, сделанные с использованием Фрибетов, не приносят дополнительных Монет. Если вы используете редкие Скины, процесс начисления монет ускоряется.',
              en: 'Coin cashback is credited automatically, only for bets from the Real balance (TON). Bets made with Free bets bring no extra Coins. Rare Skins speed up earning Coins.' } },
    { id: 'h_dup', title: { ru: 'Выпал одинаковый скин (дубликат)', en: 'I got the same skin twice (a duplicate)' },
      text: { ru: 'На платформе работает система автоматического распыления. Если вам выпадает скин, который уже есть в инвентаре, система не добавляет вторую копию, а автоматически начисляет вам компенсацию в Монетах (до 30% от его стоимости).',
              en: 'The platform dismantles duplicates automatically. If you get a skin you already own, no second copy is added: you get Coins as compensation instead (up to 30% of its value).' } },
    { id: 'b_vch', title: { ru: 'Ваучеры и фрибеты (промокоды)', en: 'Vouchers and free bets (promo codes)' }, kids: ['v_err', 'v_win', 'v_get'] },
    { id: 'v_err', title: { ru: 'Ваучер выдаёт ошибку', en: 'My voucher gives an error' },
      text: { ru: `Если при вводе ваучера возникает ошибка, скорее всего, произошло одно из трёх:
• Вы допустили опечатку при вводе кода.
• Исчерпан лимит активаций (например, ваучер был рассчитан только на первых 100 человек).
• Истёк срок действия ваучера.
Следите за новыми ваучерами ${CHANNEL_RU} и включайте уведомления, чтобы успевать первыми!`,
              en: `If a voucher gives an error, one of three things most likely happened:
• There is a typo in the code.
• The activation limit is used up (for example, the voucher was for the first 100 people only).
• The voucher has expired.
Watch for new vouchers ${CHANNEL_EN} and turn on notifications to be first!` } },
    { id: 'v_win', title: { ru: 'Как вывести выигрыш с ваучера?', en: 'How do I withdraw a voucher win?' },
      text: { ru: `Выигрыш с ваучера не требует дополнительных отыгрышей!
Как только ваша бесплатная ставка (ваучер) сыграла, <b>чистый выигрыш</b> (общая выплата минус номинал ваучера) моментально зачисляется на ваш Реальный баланс. Эти средства сразу же становятся реальными деньгами: вы можете использовать их для дальнейшей игры или вывести на свой кошелёк (при достижении минимальной суммы вывода).`,
              en: `A voucher win needs no extra wagering!
As soon as your free bet (voucher) has played, the <b>net win</b> (the payout minus the voucher's value) goes to your Real balance at once. It is real money right away: keep playing with it or withdraw it to your wallet (above the minimum withdrawal).` } },
    { id: 'v_get', title: { ru: 'Дайте промокод / Где взять ваучер?', en: 'Give me a promo code / Where do I get a voucher?' },
      text: { ru: `Служба поддержки не выдаёт индивидуальные промокоды или ваучеры. Все свежие бонусы, фрибеты и ваучеры с лимитированным количеством активаций мы публикуем только ${CHANNEL_RU}. Включайте уведомления, чтобы успевать забирать их первыми!`,
              en: `Support does not hand out personal promo codes or vouchers. All fresh bonuses, free bets and limited vouchers are published only ${CHANNEL_EN}. Turn on notifications to grab them first!` } },
    { id: 'b_tsk', title: { ru: 'Карусель заданий (как получать Монеты)', en: 'Quest carousel (how to earn Coins)' }, kids: ['t_how', 't_miss'] },
    { id: 't_how', title: { ru: 'Как работают задания?', en: 'How do quests work?' },
      text: { ru: 'В игре доступна специальная карусель заданий (подписки на каналы, игровая активность и т.д.). Выполняйте их, чтобы бесплатно получать Монеты на Бонусный баланс. Список заданий регулярно обновляется!',
              en: 'The game has a quest carousel (subscribing to channels, playing and so on). Complete quests to earn free Coins on your Bonus balance. The list is updated regularly!' } },
    { id: 't_miss', title: { ru: 'Выполнил задание, а Монеты не пришли', en: 'I completed a quest but got no Coins' }, kids: ['t_op'],
      text: { ru: 'Системе может потребоваться пара минут на проверку выполнения (особенно для подписок). Попробуйте перезапустить игру. Если Монеты так и не начислились, обратитесь к оператору.',
              en: 'The system may need a couple of minutes to check a quest (especially subscriptions). Try restarting the game. If the Coins still have not arrived, contact an operator.' } },
    { id: 't_op', title: { ru: 'Обратиться к оператору', en: 'Contact an operator' }, ask: true,
      text: { ru: `${ASK_RU}

• Название задания
• Скриншот, подтверждающий выполнение
• Подробное описание ошибки и ситуации, с которой вы столкнулись.`,
              en: `${ASK_EN}

• The name of the quest
• A screenshot proving it is done
• A detailed description of the error and what happened.` } },

    // ---------- partners ----------
    { id: 'partners', title: { ru: 'Партнёрам, блогерам и интеграциям', en: 'Partners, streamers and integrations' }, kids: ['p_blog', 'p_b2b'] },
    { id: 'p_blog', title: { ru: 'Я блогер / стример (сотрудничество)', en: 'I am a blogger / streamer (partnership)' },
      text: { ru: `Мы всегда открыты к работе с контент-мейкерами, стримерами и инфлюенсерами! Чтобы мы могли рассмотреть ваше предложение и обсудить условия (рекламные интеграции, кастомные промокоды, партнёрские выплаты), пожалуйста, отправьте заявку на нашу официальную почту: ${p.email}

В письме обязательно укажите:
• Ссылки на ваши каналы, стрим-платформы или социальные сети.
• Статистику охватов, просмотров или онлайна (приложите скриншоты аналитики).
• Формат сотрудничества, который вам интересен.`,
              en: `We are always open to working with content makers, streamers and influencers! So we can review your offer and discuss the terms (ad integrations, custom promo codes, partner payouts), please send a request to our official email: ${p.email}

Please include:
• Links to your channels, streaming platforms or social networks.
• Reach, views or live audience stats (attach analytics screenshots).
• The kind of partnership you are interested in.` } },
    { id: 'p_b2b', title: { ru: 'Платёжные системы, B2B-интеграции и провайдеры', en: 'Payment systems, B2B integrations and providers' },
      text: { ru: `Если вы представляете платёжную систему, игровой провайдер, рекламное агентство или хотите предложить техническую интеграцию для нашей платформы, поддержка в Telegram по этим вопросам не консультирует.

Пожалуйста, направьте ваше коммерческое предложение напрямую на корпоративную почту департамента развития: ${p.email}

Письма, отправленные на этот адрес, автоматически перенаправляются профильным специалистам. Если предложение нас заинтересует, мы свяжемся с вами в ближайшее время.`,
              en: `If you represent a payment system, a game provider or an ad agency, or want to offer a technical integration for our platform, support in Telegram does not handle these questions.

Please send your business proposal straight to the development department's email: ${p.email}

Letters to this address are forwarded to the right specialists automatically. If the offer interests us, we will contact you soon.` } }
  ];
  return new Map(nodes.map((n) => [n.id, n]));
}

/** Every node's parent for the "Back" button: the first node that lists it. */
export function parents(faq: Map<string, FaqNode>): Map<string, string> {
  const out = new Map<string, string>();
  const walk = (id: string) => { for (const k of faq.get(id)?.kids ?? []) if (!out.has(k) && k !== ROOT) { out.set(k, id); walk(k); } };
  walk(ROOT);
  return out;
}

/** "Вывод → Сроки вывода прошли": where a ticket came from, for the operators. */
export function pathOf(faq: Map<string, FaqNode>, par: Map<string, string>, id: string, lang: Lang): string {
  const names: string[] = [];
  for (let cur: string | undefined = id; cur && cur !== ROOT; cur = par.get(cur)) names.unshift(faq.get(cur)?.title[lang] ?? cur);
  return names.join(' → ');
}
