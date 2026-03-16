import { Env } from "./types";

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(env: Env, params: SendEmailParams): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Late Bus Alert <${env.FROM_EMAIL}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

export async function sendConfirmationEmail(
  env: Env,
  email: string,
  busRoute: string,
  confirmationToken: string
): Promise<void> {
  const confirmUrl = `${env.SITE_URL}/confirm.html?token=${confirmationToken}`;

  await sendEmail(env, {
    to: email,
    subject: `Confirm your bus delay subscription — Route ${busRoute}`,
    html: `
<p>Hi there,</p>
<p>You signed up to receive morning delay alerts for <strong>Bus Route ${busRoute}</strong>.</p>
<p>Please confirm your email address by clicking the link below:</p>
<p><a href="${confirmUrl}">Confirm my subscription</a></p>
<p>This link expires in 24 hours. If you didn't request this, you can safely ignore this email.</p>
    `.trim(),
  });
}

export async function sendDelayNotificationEmail(
  env: Env,
  email: string,
  busRoute: string,
  minutesLate: number,
  school: string,
  unsubscribeToken: string
): Promise<void> {
  const unsubscribeUrl = `${env.SITE_URL}/unsubscribed.html?token=${unsubscribeToken}`;

  await sendEmail(env, {
    to: email,
    subject: `Bus ${busRoute} is running late`,
    html: `
<p>Heads up — <strong>Bus Route ${busRoute}</strong> is running approximately <strong>${minutesLate} minutes late</strong> this morning.</p>
<p>School: ${school}</p>
<hr>
<p style="font-size:0.9em;color:#666;">
  Don't want these alerts anymore?
  <a href="${unsubscribeUrl}">Unsubscribe from Route ${busRoute}</a>
</p>
    `.trim(),
  });
}
