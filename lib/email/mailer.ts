import nodemailer from "nodemailer"
import { getSmtpConfig } from "@/lib/env"
import { AppError } from "@/lib/errors"
import { logger } from "@/lib/logging/logger"

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null

function getTransporter() {
  if (cachedTransporter) return cachedTransporter
  const config = getSmtpConfig()
  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    auth: { user: config.user, pass: config.password },
  })
  return cachedTransporter
}

export async function sendMail(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
  try {
    const config = getSmtpConfig()
    const transporter = getTransporter()
    await transporter.sendMail({
      from: `Atai <${config.from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
  } catch {
    logger.error("email.send_failed", "SMTP delivery failed")
    throw new AppError("EMAIL_UNAVAILABLE")
  }
}
