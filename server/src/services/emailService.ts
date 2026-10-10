import type { Bindings } from "../types/env.js";

/**
 * メール送信基盤(Resend)。RESEND_API_KEY が未設定の場合は無効(準備中)として扱い、
 * Stripe と同様に未設定でもアプリ全体は動作する。
 */
export function isEmailEnabled(env: Bindings): boolean {
  return Boolean(env.RESEND_API_KEY && env.MAIL_FROM);
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  quotaScope?: string;
}

export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function safeActionUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
    return escapeHtmlText(parsed.toString());
  } catch {
    return undefined;
  }
}

export async function sendEmail(env: Bindings, params: SendEmailParams): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailEnabled(env)) {
    return { sent: false, reason: "メール送信が未設定です(RESEND_API_KEY / MAIL_FROM)" };
  }

  const day = new Date().toISOString().slice(0,10);
  const scope = params.quotaScope ?? 'transactional:default';
  const invoice = scope.startsWith('invoice:');
  const security = scope.startsWith('security:');
  const scopeLimit = invoice ? 20 : security ? 5 : 10;
  const categoryPattern = invoice ? 'invoice:%' : security ? 'security:%' : 'transactional:%';
  const categoryLimit = invoice ? 60 : security ? 30 : 10;
  // One atomic statement reserves provider capacity. Invoice mail cannot consume
  // the capacity reserved for identity workflows; each tenant/user has a limit.
  const reservation = await env.DB.prepare(`INSERT INTO EmailDailyUsage(day,scope,attempts)
    SELECT ?,?,1 WHERE
      (SELECT COALESCE(SUM(attempts),0) FROM EmailDailyUsage WHERE day=?)<90 AND
      (SELECT COALESCE(SUM(attempts),0) FROM EmailDailyUsage WHERE day=? AND scope LIKE ?)< ?
    ON CONFLICT(day,scope) DO UPDATE SET attempts=attempts+1 WHERE attempts<? RETURNING attempts`)
    .bind(day,scope,day,day,categoryPattern,categoryLimit,scopeLimit).first();
  if (!reservation) return { sent:false, reason:'メール送信の本日分の上限に達しました。翌日再試行してください' };
  await env.DB.prepare('DELETE FROM EmailDailyUsage WHERE day<?').bind(day).run();

  let res: Response;
  try {
  res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [params.to],
      subject: params.subject.replace(/[\r\n\u0000-\u001f\u007f]/g, ' '),
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    }),
  });
  } catch {
    return { sent: false, reason: 'メール送信サービスに接続できませんでした。時間をおいて再試行してください' };
  }

  if (!res.ok) {
    return { sent: false, reason: `メール送信に失敗しました(${res.status})。時間をおいて再試行してください` };
  }
  return { sent: true };
}

/** 汎用のシンプルなHTMLメールテンプレート。 */
export function renderEmail(options: { heading: string; bodyHtml: string; actionLabel?: string; actionUrl?: string }): string {
  const actionUrl = options.actionUrl ? safeActionUrl(options.actionUrl) : undefined;
  const button =
    options.actionLabel && actionUrl
      ? `<p style="margin:24px 0;"><a href="${actionUrl}" style="background:#226e5a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;display:inline-block;font-weight:600;">${escapeHtmlText(options.actionLabel)}</a></p>`
      : "";
  return `<div style="font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
    <h2 style="font-size:18px;color:#153a31;">${escapeHtmlText(options.heading)}</h2>
    <div style="font-size:14px;line-height:1.7;color:#374151;">${options.bodyHtml}</div>
    ${button}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size:12px;color:#9ca3af;">Kaikei 会計ソフト</p>
  </div>`;
}
