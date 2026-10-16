import nodemailer from "nodemailer";

export function isSmtpConfigured(): boolean {
  return Boolean(
    process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim(),
  );
}

export async function sendRegisterCodeEmail(
  to: string,
  code: string,
): Promise<void> {
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!user || !pass) {
    throw new Error("未配置 SMTP，请在 .env.local 填写 SMTP_USER / SMTP_PASS");
  }

  const host = process.env.SMTP_HOST?.trim() || "smtp.qq.com";
  const port = Number(process.env.SMTP_PORT || 465);
  const from = process.env.SMTP_FROM?.trim() || `Atoms Ops Demo <${user}>`;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from,
    to,
    subject: "Atoms Ops Demo 注册验证码",
    text: `您的注册验证码是 ${code}，10 分钟内有效。如非本人操作请忽略。`,
    html: `<p>您的注册验证码是 <strong style="font-size:18px;letter-spacing:2px">${code}</strong></p><p>10 分钟内有效。如非本人操作请忽略。</p>`,
  });
}
