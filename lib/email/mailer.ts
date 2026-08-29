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
    auth: { user: config.user, pass: config.password },
  })
  return cachedTransporter
}

export async function sendMail(params: { to: string; subject: string; html: string; text: string }): Promise<void> {
  const config = getSmtpConfig()
  const transporter = getTransporter()
  try {
    await transporter.sendMail({
      from: `MirrorSite AI <${config.from}>`,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    })
  } catch (error) {
    logger.error("email.send_failed", "SMTP delivery failed", { to: params.to, subject: params.subject, error: String(error) })
    throw new AppError("EMAIL_UNAVAILABLE")
  }
}
