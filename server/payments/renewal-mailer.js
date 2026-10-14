import nodemailer from 'nodemailer';
import { displayDate, rubles } from './rules.js';

// Service notice, not a marketing mailing. Test-only recipient and origin
// checks are performed by the worker before this function is called.
export async function sendRenewalNotice({ email, amount, chargeAt, plan }) {
  const e = process.env;
  if (!e.SMTP_HOST || !e.SMTP_SUPPORT_USER || !e.SMTP_SUPPORT_PASS) return false;
  const transport = nodemailer.createTransport({
    host: e.SMTP_HOST, port: Number(e.SMTP_PORT || 465),
    secure: Number(e.SMTP_PORT || 465) === 465,
    auth: { user: e.SMTP_SUPPORT_USER, pass: e.SMTP_SUPPORT_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 20000,
  });
  const text = `Здравствуйте!\n\nЭто тестовое уведомление legche.online. Реальные деньги не списываются.\n\nЗапланировано тестовое продление подписки на ${plan === 'month' ? 'месяц' : 'год'}: ${displayDate(chargeAt)}. Сумма — ${rubles(amount)} ₽.\n\nОтключить автопродление можно на странице:\nhttps://test.legche.online/subscription-test\n\nПосле отключения доступ сохранится до окончания оплаченного периода. Если платёж уже совершён, отключение остановит последующие списания.\n\nПоддержка: support@legche.online`;
  try {
    const result = await transport.sendMail({
      from: `ЛЕГЧЕ · Поддержка <${e.SMTP_SUPPORT_USER}>`, to: email,
      subject: 'Тест: предстоящее продление подписки ЛЕГЧЕ', text,
    });
    return result.accepted?.some(value => String(value).toLowerCase() === email.toLowerCase()) === true;
  } catch { return false; }
  finally { transport.close(); }
}
