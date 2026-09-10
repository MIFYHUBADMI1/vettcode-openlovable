/** Branded transactional email templates — premium glassmorphism aesthetic. */

const BRAND_COLOR = "#6366f1"
const BRANDGradient = "linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)"

function shell(title: string, bodyHtml: string, accentColor?: string): string {
  const accent = accentColor ?? BRAND_COLOR
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
      }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
        50% { box-shadow: 0 0 24px 6px rgba(99,102,241,0.12); }
      }
      @keyframes shimmer {
        0% { opacity: 0.4; transform: translateX(-100%); }
        50% { opacity: 0.8; }
        100% { opacity: 0.4; transform: translateX(100%); }
      }
      @keyframes borderGlow {
        0%, 100% { border-color: rgba(99,102,241,0.15); box-shadow: 0 0 40px -12px rgba(99,102,241,0.08), 0 25px 50px -12px rgba(0,0,0,0.5); }
        50% { border-color: rgba(99,102,241,0.35); box-shadow: 0 0 60px -8px rgba(99,102,241,0.18), 0 25px 50px -12px rgba(0,0,0,0.5); }
      }
      @keyframes dotFloat {
        0% { transform: translate(0, 0); opacity: 0.3; }
        33% { transform: translate(12px, -18px); opacity: 0.6; }
        66% { transform: translate(-8px, -8px); opacity: 0.4; }
        100% { transform: translate(0, 0); opacity: 0.3; }
      }
      @keyframes aurora {
        0% { transform: rotate(0deg) scale(1); }
        33% { transform: rotate(120deg) scale(1.05); }
        66% { transform: rotate(240deg) scale(0.95); }
        100% { transform: rotate(360deg) scale(1); }
      }
      @keyframes lineReveal {
        from { opacity: 0; transform: translateX(-8px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes shimmerBorder {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#09090b;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
    <div style="max-width:500px;margin:40px auto;padding:0 16px;">

      <!-- Aurora background glow -->
      <div style="position:relative;">
        <div style="
          position:absolute;top:-100px;right:-80px;
          width:300px;height:300px;border-radius:50%;
          background:radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%);
          filter:blur(60px);
          animation:aurora 20s ease-in-out infinite;
          pointer-events:none;
        "></div>
        <div style="
          position:absolute;bottom:-80px;left:-60px;
          width:250px;height:250px;border-radius:50%;
          background:radial-gradient(circle, rgba(139,92,246,0.06), transparent 70%);
          filter:blur(60px);
          animation:aurora 16s ease-in-out -8s infinite;
          pointer-events:none;
        "></div>
      </div>

      <!-- Outer glass card -->
      <div style="
        position:relative;
        background:rgba(17,17,20,0.9);
        backdrop-filter:blur(20px);
        -webkit-backdrop-filter:blur(20px);
        border-radius:20px;
        overflow:hidden;
        border:1px solid rgba(99,102,241,0.15);
        animation:borderGlow 4s ease-in-out infinite;
        box-shadow:0 0 40px -12px rgba(99,102,241,0.1), 0 25px 50px -12px rgba(0,0,0,0.5);
      ">

        <!-- Animated gradient header bar -->
        <div style="
          height:4px;
          background:linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa, #c084fc, #818cf8, #6366f1);
          background-size:300% 100%;
          animation:gradientShift 4s ease infinite;
        "></div>

        <!-- Shimmer overlay -->
        <div style="
          position:absolute;top:4px;left:0;right:0;height:40px;
          background:linear-gradient(90deg, transparent, rgba(99,102,241,0.04), transparent);
          background-size:200% 100%;
          animation:shimmerBorder 6s ease-in-out infinite;
          pointer-events:none;
        "></div>

        <!-- Floating decorative dots -->
        <div style="position:relative;padding:0 32px;height:0;overflow:visible;">
          <div style="
            position:absolute;top:-30px;right:40px;
            width:8px;height:8px;border-radius:50%;
            background:rgba(139,92,246,0.4);
            animation:dotFloat 3s ease-in-out infinite;
          "></div>
          <div style="
            position:absolute;top:-50px;right:80px;
            width:5px;height:5px;border-radius:50%;
            background:rgba(99,102,241,0.3);
            animation:dotFloat 4s ease-in-out 0.5s infinite;
          "></div>
          <div style="
            position:absolute;top:-20px;left:60px;
            width:6px;height:6px;border-radius:50%;
            background:rgba(167,139,250,0.3);
            animation:dotFloat 3.5s ease-in-out 1s infinite;
          "></div>
          <div style="
            position:absolute;top:-40px;left:120px;
            width:4px;height:4px;border-radius:50%;
            background:rgba(129,140,248,0.25);
            animation:dotFloat 5s ease-in-out 1.5s infinite;
          "></div>
        </div>

        <!-- Brand header -->
        <div style="padding:36px 36px 0 36px;text-align:center;">
          <!-- Glowing brand icon -->
          <div style="
            display:inline-block;
            width:60px;height:60px;
            border-radius:16px;
            background:linear-gradient(135deg, #6366f1, #8b5cf6);
            text-align:center;
            line-height:60px;
            font-size:26px;
            font-weight:800;
            color:#ffffff;
            animation:float 3s ease-in-out infinite, pulse 2.5s ease-in-out infinite;
            box-shadow:0 8px 32px rgba(99,102,241,0.35), 0 0 0 1px rgba(99,102,241,0.2);
          ">M</div>
          <div style="
            margin-top:14px;
            font-size:13px;
            font-weight:600;
            letter-spacing:0.08em;
            color:#818cf8;
            text-transform:uppercase;
          ">MirrorSite AI</div>
        </div>

        <!-- Content area -->
        <div style="padding:28px 36px 36px 36px;">
          <!-- Title with gradient text -->
          <h1 style="
            font-size:24px;
            font-weight:700;
            color:#f4f4f5;
            margin:0 0 8px 0;
            text-align:center;
            letter-spacing:-0.02em;
          ">${title}</h1>

          <!-- Gradient decorative line -->
          <div style="
            width:48px;height:3px;
            margin:0 auto 28px auto;
            border-radius:2px;
            background:linear-gradient(90deg, #6366f1, #a78bfa, #6366f1);
            background-size:200% 100%;
            animation:gradientShift 3s ease infinite;
          "></div>

          ${bodyHtml}

          <!-- Decorative bottom dots -->
          <div style="text-align:center;margin-top:32px;">
            <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:rgba(99,102,241,0.25);margin:0 4px;"></span>
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:rgba(139,92,246,0.4);margin:0 4px;"></span>
            <span style="display:inline-block;width:4px;height:4px;border-radius:50%;background:rgba(99,102,241,0.25);margin:0 4px;"></span>
          </div>
        </div>

        <!-- Footer -->
        <div style="
          padding:20px 36px;
          border-top:1px solid rgba(99,102,241,0.08);
          background:rgba(99,102,241,0.02);
          text-align:center;
        ">
          <p style="font-size:11px;color:#52525b;margin:0;line-height:1.6;">
            &copy; 2026 MirrorSite AI &middot; Build smarter, ship faster
          </p>
          <p style="font-size:10px;color:#3f3f46;margin:8px 0 0 0;line-height:1.4;">
            This is a transactional email regarding your account.
          </p>
        </div>
      </div>
    </div>
  </body>
</html>`
}

function button(href: string, label: string): string {
  return `<div style="text-align:center;margin:28px 0 0 0;">
    <a href="${href}" style="
      display:inline-block;
      padding:16px 36px;
      background:linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%);
      background-size:200% 100%;
      color:#ffffff;
      text-decoration:none;
      border-radius:12px;
      font-weight:700;
      font-size:15px;
      letter-spacing:0.01em;
      box-shadow:0 4px 24px rgba(99,102,241,0.45), 0 0 0 1px rgba(99,102,241,0.2);
      transition:all 0.2s ease;
    ">${label}</a>
    <div style="
      margin-top:14px;
      font-size:12px;
      color:#52525b;
      word-break:break-all;
    ">or paste this link: <span style="color:#818cf8;">${href}</span></div>
  </div>`
}

function infoBox(content: string): string {
  return `<div style="
    margin:20px 0;
    padding:16px 20px;
    background:rgba(99,102,241,0.04);
    border:1px solid rgba(99,102,241,0.12);
    border-radius:12px;
    font-size:13px;
    color:#a1a1aa;
    line-height:1.6;
    backdrop-filter:blur(8px);
  ">${content}</div>`
}

function codeBlock(code: string): string {
  return `<div style="
    margin:16px 0;
    padding:14px 20px;
    background:rgba(9,9,11,0.8);
    border:1px solid rgba(99,102,241,0.2);
    border-radius:10px;
    font-family:'SF Mono',SFMono-Regular,Menlo,Consolas,monospace;
    font-size:14px;
    color:#a78bfa;
    text-align:center;
    letter-spacing:0.05em;
    font-weight:600;
    backdrop-filter:blur(8px);
  ">${code}</div>`
}

function statRow(stats: Array<{ label: string; value: string }>): string {
  const cells = stats.map(s => `
    <td style="text-align:center;padding:0 16px;">
      <div style="font-size:18px;font-weight:700;color:#f4f4f5;">${s.value}</div>
      <div style="font-size:11px;color:#71717a;margin-top:2px;">${s.label}</div>
    </td>
  `).join("")
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;"><tr>${cells}</tr></table>`
}

export function verificationEmail(name: string, verifyUrl: string) {
  const html = shell(
    "Confirm your email",
    `<p style="font-size:15px;line-height:1.7;color:#d4d4d8;margin:0 0 4px 0;">Hey <strong style="color:#f4f4f5;">${escapeHtml(name)}</strong> 👋</p>
     <p style="font-size:15px;line-height:1.7;color:#a1a1aa;margin:0 0 20px 0;">
       Welcome to the future of app building. Confirm your email and unlock AI-powered development.
     </p>
     ${button(verifyUrl, "✨ Verify Email Address")}
     ${infoBox("⏱ This link expires in <strong style=\"color:#d4d4d8;\">24 hours</strong>. If you didn't create this account, just ignore this email.")}
     ${statRow([
       { label: "Free Credits", value: "500" },
       { label: "Deploy Time", value: "< 1m" },
       { label: "Setup", value: "0s" },
     ])}
     <p style="font-size:12px;color:#71717a;text-align:center;margin:0;line-height:1.6;">
       You're joining <strong style="color:#d4d4d8;">2,400+</strong> builders shipping apps with AI.
     </p>`,
  )
  const text = `Hey ${name}, confirm your email: ${verifyUrl} (expires in 24 hours)`
  return { subject: "✨ Confirm your MirrorSite AI account", html, text }
}

export function passwordResetEmail(name: string, resetUrl: string) {
  const html = shell(
    "Reset your password",
    `<p style="font-size:15px;line-height:1.7;color:#d4d4d8;margin:0 0 4px 0;">Hey <strong style="color:#f4f4f5;">${escapeHtml(name)}</strong></p>
     <p style="font-size:15px;line-height:1.7;color:#a1a1aa;margin:0 0 20px 0;">
       No worries — it happens to the best of us. Click below to set a new password.
     </p>
     ${button(resetUrl, "🔑 Reset Password")}
     ${infoBox("⏱ This link expires in <strong style=\"color:#d4d4d8;\">1 hour</strong>. If you didn't request this, you can safely ignore this email.")}
     <div style="
       margin:20px 0;
       padding:16px 20px;
       background:rgba(34,197,94,0.04);
       border:1px solid rgba(34,197,94,0.12);
       border-radius:12px;
       font-size:13px;
       color:#a1a1aa;
       line-height:1.6;
     ">
       <strong style="color:#f4f4f5;">🛡️ Your data stays safe.</strong> Resetting your password won't affect your projects, credits, or deployments.
     </div>`,
  )
  const text = `Hey ${name}, reset your password: ${resetUrl} (expires in 1 hour)`
  return { subject: "🔑 Reset your MirrorSite AI password", html, text }
}

export function emailChangeEmail(name: string, newEmail: string, confirmUrl: string) {
  const html = shell(
    "Confirm your new email",
    `<p style="font-size:15px;line-height:1.7;color:#d4d4d8;margin:0 0 4px 0;">Hey <strong style="color:#f4f4f5;">${escapeHtml(name)}</strong></p>
     <p style="font-size:15px;line-height:1.7;color:#a1a1aa;margin:0 0 20px 0;">
       We received a request to update your email address.
     </p>
     ${codeBlock(escapeHtml(newEmail))}
     ${button(confirmUrl, "📧 Confirm Email Change")}
     ${infoBox("⏱ This link expires in <strong style=\"color:#d4d4d8;\">1 hour</strong>. If you didn't request this change, your current email stays the same.")}`,
  )
  const text = `Hey ${name}, confirm your email change to ${newEmail}: ${confirmUrl} (expires in 1 hour)`
  return { subject: "📧 Confirm your new email address", html, text }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string)
}
