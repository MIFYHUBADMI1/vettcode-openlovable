/** Branded transactional email templates (spec section 5). */

const BRAND_COLOR = "#6366f1"

function shell(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#0b0c10;font-family:Helvetica,Arial,sans-serif;">
    <div style="max-width:480px;margin:40px auto;background:#151720;border-radius:12px;overflow:hidden;border:1px solid #262a36;">
      <div style="padding:28px 32px 0 32px;">
        <div style="font-size:15px;font-weight:700;letter-spacing:-0.01em;color:#f4f5f7;">MirrorSite AI</div>
      </div>
      <div style="padding:20px 32px 32px 32px;color:#c7cad1;">
        <h1 style="font-size:20px;color:#f4f5f7;margin:0 0 12px 0;">${title}</h1>
        ${bodyHtml}
      </div>
    </div>
  </body>
</html>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:8px;padding:12px 20px;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${label}</a>`
}

export function verificationEmail(name: string, verifyUrl: string) {
  const html = shell(
    "Confirm your email",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)}, welcome to MirrorSite AI. Confirm your email address to activate your account and start rebuilding sites.</p>
     ${button(verifyUrl, "Verify email address")}
     <p style="font-size:12px;color:#8b8f99;margin-top:20px;">This link expires in 24 hours. If you didn't create this account, you can ignore this email.</p>`,
  )
  const text = `Hi ${name}, confirm your email address: ${verifyUrl} (expires in 24 hours)`
  return { subject: "Confirm your MirrorSite AI account", html, text }
}

export function passwordResetEmail(name: string, resetUrl: string) {
  const html = shell(
    "Reset your password",
    `<p style="font-size:14px;line-height:1.6;">Hi ${escapeHtml(name)}, we received a request to reset your MirrorSite AI password.</p>
     ${button(resetUrl, "Reset password")}
     <p style="font-size:12px;color:#8b8f99;margin-top:20px;">This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
  )
  const text = `Hi ${name}, reset your password: ${resetUrl} (expires in 1 hour)`
  return { subject: "Reset your MirrorSite AI password", html, text }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}
