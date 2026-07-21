// Отправка писем через Zoho SMTP.
//
//   support@legche.online — системные письма (сброс пароля)
//   inga@legche.online    — живой голос: цепочка триала (Email_cepochka_triala_v2.md, утверждено 20.07.2026)
//
// Переменные окружения — см. .env.example.
// Если SMTP не настроен — письма не отправляются, событие пишется в консоль
// (так локальная разработка не требует настоящих ящиков).

import crypto from "crypto";
import nodemailer from "nodemailer";

const HOST = process.env.SMTP_HOST || "";
const PORT = Number(process.env.SMTP_PORT || 465);
const SENDER_NAME = process.env.SMTP_SENDER_NAME || "Инга";
const SITE_URL = process.env.SITE_URL || "https://legche.online";
// Прямых ссылок вглубь экранов (например, сразу в «Лёгкую версию») пока нет —
// кнопки в письмах ведут на корень приложения.
const APP_URL = process.env.APP_URL || "https://app.legche.online";

function makeTransport(user, pass) {
  if (!HOST || !user || !pass) return null;
  return nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user, pass },
  });
}

const supportTransport = makeTransport(process.env.SMTP_SUPPORT_USER, process.env.SMTP_SUPPORT_PASS);
const ingaTransport = makeTransport(process.env.SMTP_INGA_USER, process.env.SMTP_INGA_PASS);

async function send(transport, fromAddress, fromName, to, subject, html, text, logLabel) {
  if (!transport) {
    console.log(`[mail:${logLabel}] SMTP не настроен — письмо не отправлено. To: ${to} | Subject: ${subject}`);
    return { sent: false };
  }
  try {
    await transport.sendMail({ from: `"${fromName}" <${fromAddress}>`, to, subject, html, text: text || undefined });
    return { sent: true };
  } catch (e) {
    console.error(`[mail:${logLabel}] отправка не удалась:`, e.message);
    return { sent: false, error: e.message };
  }
}

// ── Токен отписки без отдельной таблицы: HMAC от userId на JWT_SECRET ──────
export function unsubscribeToken(userId) {
  return crypto.createHmac("sha256", process.env.JWT_SECRET || "").update(userId).digest("hex").slice(0, 32);
}
export function verifyUnsubscribeToken(userId, token) {
  return unsubscribeToken(userId) === String(token || "");
}
function unsubscribeUrl(userId) {
  return `${SITE_URL.replace(/\/$/, "")}/api/v1/email/unsubscribe?uid=${userId}&token=${unsubscribeToken(userId)}`;
}

// ── HTML-каркас письма ──────────────────────────────────────────────────────
function wrapHtml(bodyHtml, footerExtra) {
  return `<!DOCTYPE html>
<html lang="ru">
<body style="margin:0;padding:0;background:#FAF5F0;font-family:-apple-system,Manrope,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAF5F0;padding:32px 0;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#FF6200;padding:20px 32px;">
          <span style="color:#fff;font-weight:700;font-size:18px;">legche.online</span>
        </td></tr>
        <tr><td style="padding:32px;color:#2C1A0E;font-size:15px;line-height:1.6;">
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #EDE5DF;color:#8A7A70;font-size:12px;">
          Инга Кеосиди · Метод «Лёгкая замена» · legche.online
          ${footerExtra || ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function ctaButton(label, url) {
  return `<p style="margin:0 0 20px;"><a href="${url}" style="display:inline-block;background:#FF6200;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;">${label}</a></p>`;
}

function unsubscribeFooter(userId) {
  return `<br/><a href="${unsubscribeUrl(userId)}" style="color:#B0A398;">Отписаться от этих писем</a>`;
}

// ── support@ — сброс пароля ──────────────────────────────────────────────

export async function sendPasswordResetEmail(to, link) {
  const html = wrapHtml(`
    <p style="margin:0 0 16px;">Здравствуйте!</p>
    <p style="margin:0 0 20px;">Вы запросили восстановление пароля в приложении legche.online. Чтобы задать новый пароль, перейдите по ссылке ниже — она действует ограниченное время.</p>
    ${ctaButton("Задать новый пароль", link)}
    <p style="margin:0;color:#8A7A70;font-size:13px;">Если это были не вы — просто проигнорируйте письмо, пароль останется прежним.</p>
  `);
  const text = `Восстановление пароля legche.online.\n\nПерейдите по ссылке, чтобы задать новый пароль:\n${link}\n\nЕсли это были не вы — проигнорируйте это письмо.`;
  return send(supportTransport, process.env.SMTP_SUPPORT_USER, SENDER_NAME + " · Поддержка", to, "Восстановление пароля — legche.online", html, text, "password-reset");
}

// ── inga@ — цепочка триала (тексты утверждены 20.07.2026) ──────────────────

function greet(name) {
  return name ? `${name}, здравствуйте!` : "Здравствуйте!";
}

// День 0 — сразу после регистрации (заменяет прежнее welcome-письмо)
export async function sendDay0Email(to, name, userId) {
  const g = greet(name);
  const html = wrapHtml(`
    <p style="margin:0 0 16px;">${g}</p>
    <p style="margin:0 0 16px;">Я — Инга, автор метода «Лёгкая замена». Рада, что вы здесь.</p>
    <p style="margin:0 0 16px;">Не буду грузить вас инструкциями. Первый шаг один, и он занимает 5 секунд: откройте «Лёгкую версию» и введите блюдо, от которого вы не готовы отказаться. Шарлотку, оливье, жареную картошку — что любите. Увидите, как оно становится легче — это и есть весь метод в одном экране.</p>
    ${ctaButton("Ввести моё блюдо", APP_URL)}
    <p style="margin:0 0 16px;">Дальше вас поведёт программа «Месяц 1»: один короткий урок и одно простое действие в день. Без домашних заданий и подсчётов.</p>
    <p style="margin:0 0 16px;">Если что-то не будет получаться — просто ответьте на это письмо. Я отвечаю лично.</p>
    <p style="margin:0;">Лёгкого начала!<br/>Инга</p>
  `, unsubscribeFooter(userId));
  // A/B-тест темы (утверждено 21.07.2026): вариант выбирается по userId стабильно,
  // чтобы при повторной отправке тема не менялась. Вариант логируется в user_events.
  const DAY0_SUBJECTS = [
    "Начните с одного блюда 🍊",
    "Ваше первое блюдо ждёт",
    "5 секунд — и увидите метод в деле",
  ];
  const variant = Math.abs([...String(userId)].reduce((a, c) => a + c.charCodeAt(0), 0)) % DAY0_SUBJECTS.length;
  const result = await send(ingaTransport, process.env.SMTP_INGA_USER, SENDER_NAME, to, DAY0_SUBJECTS[variant], html, null, "day0");
  return { ...result, subjectVariant: variant };
}

// День 3 — вариант А (была активна)
async function sendDay3A(to, name, userId, stats) {
  const g = greet(name);
  const kopilkaLine = stats.kopilka_kcal > 0 ? `, ${stats.kopilka_kcal} ккал в копилке лёгкости` : "";
  const html = wrapHtml(`
    <p style="margin:0 0 16px;">${g}</p>
    <p style="margin:0 0 16px;">Три дня — и вот что у вас уже есть: ${stats.dish_count} блюд в лёгкой версии, ${stats.diary_days} дня с дневником${kopilkaLine}.</p>
    <p style="margin:0 0 16px;">Маленькие замены — большой результат: эти цифры растут от обычной еды, без запретов и голода. Ровно так и задумано.</p>
    <p style="margin:0 0 16px;">Один шаг на сегодня: введите в «Лёгкую версию» блюдо, по которому скучаете сильнее всего. Самое «запретное». Посмотрим, что с ним можно сделать.</p>
    ${ctaButton("Ввести блюдо", APP_URL)}
    <p style="margin:0;">Инга</p>
  `, unsubscribeFooter(userId));
  return send(ingaTransport, process.env.SMTP_INGA_USER, SENDER_NAME, to, `${name || "Вы"}, ваши первые цифры`, html, null, "day3a");
}

// День 3 — вариант Б (не заходила)
async function sendDay3B(to, name, userId) {
  const g = greet(name);
  const html = wrapHtml(`
    <p style="margin:0 0 16px;">${g}</p>
    <p style="margin:0 0 16px;">Вижу, что до приложения руки пока не дошли — это нормально: у моих читательниц обычно семья, работа и ноль свободных вечеров. Метод на это и рассчитан.</p>
    <p style="margin:0 0 16px;">Начните с одного действия на 5 секунд — без уроков и настроек: введите блюдо, от которого не готовы отказаться, и посмотрите на его лёгкую версию.</p>
    ${ctaButton("Ввести моё блюдо", APP_URL)}
    <p style="margin:0 0 16px;">Этого достаточно, чтобы понять, ваш это метод или нет.</p>
    <p style="margin:0;">Инга</p>
  `, unsubscribeFooter(userId));
  return send(ingaTransport, process.env.SMTP_INGA_USER, SENDER_NAME, to, "Одно блюдо — и вы в методе", html, null, "day3b");
}

export async function sendDay3Email(to, name, userId, stats) {
  const inactive = stats.diary_days === 0 && stats.dish_count === 0;
  return inactive ? sendDay3B(to, name, userId) : sendDay3A(to, name, userId, stats);
}

// День 6 (вечер) — вариант А, с ценой основателей (если места ещё есть)
async function sendDay6A(to, name, userId, stats, founderPricingAvailable) {
  const g = greet(name);
  const kopilkaLine = stats.kopilka_kcal > 0 ? `${stats.kopilka_kcal} ккал в вашей копилке, ` : "";
  const pricingBlock = founderPricingAvailable
    ? `<p style="margin:0 0 16px;">Если метод ваш — вот условия для первых 100 подписчиц: 4 990 ₽ за год (это ≈415 ₽ в месяц — меньше одной чашки кофе с десертом) или 990 ₽ в месяц. Навсегда — вы помогаете продукту расти, а я закрепляю за вами эту цену. Когда 100 мест закончатся, предложение исчезнет.</p>
       <p style="margin:0 0 16px;">Для сравнения: одна консультация нутрициолога стоит 6 000–12 000 ₽. Год ежедневной поддержки здесь — дешевле одной встречи.</p>
       ${ctaButton("Продолжить со стартовой ценой", SITE_URL)}`
    : `<p style="margin:0 0 16px;">Если метод ваш — продолжить можно за 1 490 ₽ в месяц или 6 990 ₽ за год.</p>
       ${ctaButton("Продолжить с методом", SITE_URL)}`;
  const html = wrapHtml(`
    <p style="margin:0 0 16px;">${g}</p>
    <p style="margin:0 0 16px;">Завтра завершается ваша бесплатная неделя. Как и обещала — без автосписаний и уговоров: карту вы не оставляли, само ничего не спишется.</p>
    <p style="margin:0 0 16px;">Просто факты за неделю: ${kopilkaLine}${stats.dish_count} блюд в лёгкой версии, ${stats.diary_days} дней с дневником. Это не сила воли — это замены. Дальше они складываются в килограммы: медленно, зато без возвратов.</p>
    ${pricingBlock}
    <p style="margin:0 0 16px;">Если решите не продолжать — ничего делать не нужно, и спасибо, что попробовали. Ваш дневник и копилка сохранятся: вернуться можно в любой момент.</p>
    <p style="margin:0;">Инга</p>
  `, unsubscribeFooter(userId));
  return send(ingaTransport, process.env.SMTP_INGA_USER, SENDER_NAME, to, "Завтра — развилка. Всё честно, как обещала", html, null, "day6a");
}

// День 6 — вариант Б (не активировалась)
async function sendDay6B(to, name, userId, founderPricingAvailable) {
  const g = greet(name);
  const pricingNote = founderPricingAvailable
    ? "предложение для первых 100 подписчиц ещё действует (4 990 ₽/год, закрепляется навсегда)"
    : "продолжить можно за 1 490 ₽/мес или 6 990 ₽/год";
  const html = wrapHtml(`
    <p style="margin:0 0 16px;">${g}</p>
    <p style="margin:0 0 16px;">Завтра завершается пробная неделя, а вы так и не успели попробовать метод — бывает, неделя выдалась не та.</p>
    <p style="margin:0 0 16px;">Предлагаю честно: потратьте 5 секунд сейчас — введите одно любимое блюдо и посмотрите на его лёгкую версию. Если отзовётся — ${pricingNote}. Если нет — просто ничего не делайте, никаких списаний не будет.</p>
    ${ctaButton("Ввести блюдо", APP_URL)}
    <p style="margin:0;">Инга</p>
  `, unsubscribeFooter(userId));
  return send(ingaTransport, process.env.SMTP_INGA_USER, SENDER_NAME, to, "Ваша неделя заканчивается — и это не страшно", html, null, "day6b");
}

export async function sendDay6Email(to, name, userId, stats, founderPricingAvailable) {
  const inactive = stats.diary_days === 0 && stats.dish_count === 0;
  return inactive ? sendDay6B(to, name, userId, founderPricingAvailable) : sendDay6A(to, name, userId, stats, founderPricingAvailable);
}

// День 10 — только для тех, кто не оплатил
export async function sendDay10Email(to, name, userId) {
  const g = greet(name);
  const html = wrapHtml(`
    <p style="margin:0 0 16px;">${g}</p>
    <p style="margin:0 0 16px;">Короткое письмо без уговоров: ваш дневник и копилка на месте, подписка ждёт, когда будете готовы. Если среди первых 100 подписчиц ещё останутся места — цена будет прежней; если закончатся — честно скажу об этом на сайте.</p>
    <p style="margin:0 0 16px;">А пока — лёгкая версия открыта для всех на сайте: три подбора без регистрации.</p>
    <p style="margin:0;">Лёгкости вам!<br/>Инга</p>
  `, unsubscribeFooter(userId));
  return send(ingaTransport, process.env.SMTP_INGA_USER, SENDER_NAME, to, "Дверь не закрылась", html, null, "day10");
}
