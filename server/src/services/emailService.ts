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
}

export async function sendEmail(env: Bindings, params: SendEmailParams): Promise<{ sent: boolean; reason?: string }> {
  if (!isEmailEnabled(env)) {
    return { sent: false, reason: "メール送信が未設定です(RESEND_API_KEY / MAIL_FROM)" };
  }

  const day = new Date().toISOString().slice(0,10);
  const reservation = await env.DB.prepare(`INSERT INTO EmailDailyUsage(day,attempts) VALUES (?,1)
    ON CONFLICT(day) DO UPDATE SET attempts=attempts+1 WHERE attempts<90 RETURNING attempts`).bind(day).first();
  if (!reservation) return { sent:false, reason:'メール送信の日次上限90通に達しました' };
  await env.DB.prepare('DELETE FROM EmailDailyUsage WHERE day<?').bind(day).run();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { sent: false, reason: `メール送信に失敗しました(${res.status}) ${detail}`.trim() };
  }
  return { sent: true };
}

/** 汎用のシンプルなHTMLメールテンプレート。 */
export function renderEmail(options: { heading: string; bodyHtml: string; actionLabel?: string; actionUrl?: string }): string {
  const button =
    options.actionLabel && options.actionUrl
      ? `<p style="margin:24px 0;"><a href="${options.actionUrl}" style="background:#226e5a;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;display:inline-block;font-weight:600;">${options.actionLabel}</a></p>`
      : "";
  return `<div style="font-family:'Hiragino Kaku Gothic ProN','Yu Gothic',Meiryo,sans-serif;max-width:480px;margin:0 auto;color:#1f2937;">
    <h2 style="font-size:18px;color:#153a31;">${options.heading}</h2>
    <div style="font-size:14px;line-height:1.7;color:#374151;">${options.bodyHtml}</div>
    ${button}
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="font-size:12px;color:#9ca3af;">Kaikei 会計ソフト</p>
  </div>`;
}
