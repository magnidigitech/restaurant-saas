import nodemailer from "nodemailer";

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface SendMailResult {
  success: boolean;
  messageId?: string;
  simulated?: boolean;
  error?: string;
}

/**
 * Returns the base application URL for generating absolute links
 */
export function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  }
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/**
 * Create or reuse nodemailer transport
 */
function createMailerTransport() {
  const host = process.env.SMTP_HOST || "mail.restobird.com";
  const port = parseInt(process.env.SMTP_PORT || "465", 10);
  const user = process.env.SMTP_USER || "info@restobird.com";
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const secure = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === "true" : port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED === "true",
    },
  });
}

/**
 * Send an email via SMTP or output to terminal if SMTP is unconfigured in development
 */
export async function sendMail(options: MailOptions): Promise<SendMailResult> {
  const rawFrom = options.from || process.env.SMTP_FROM || "info@restobird.com";
  const from = rawFrom.includes("<") ? rawFrom : `"Resto Bird" <${rawFrom}>`;

  const transport = createMailerTransport();

  // If no SMTP configured, provide high-visibility developer logging
  if (!transport) {
    const divider = "=".repeat(70);
    console.log(`\n${divider}`);
    console.log(`📨 [MAIL SERVER SIMULATION - SMTP UNCONFIGURED]`);
    console.log(`To:      ${options.to}`);
    console.log(`From:    ${from}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Date:    ${new Date().toISOString()}`);
    console.log(`-`.repeat(70));
    console.log(options.text || `[HTML Content - Length: ${options.html.length} chars]`);
    console.log(`${divider}\n`);

    return {
      success: true,
      messageId: `simulated-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      simulated: true,
    };
  }

  try {
    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });

    console.log(`✓ Email sent successfully to ${options.to} (Message ID: ${info.messageId})`);
    return {
      success: true,
      messageId: info.messageId,
      simulated: false,
    };
  } catch (err: any) {
    console.error(`✗ Error sending email to ${options.to}:`, err);
    return {
      success: false,
      error: err.message || "Failed to send email",
    };
  }
}
