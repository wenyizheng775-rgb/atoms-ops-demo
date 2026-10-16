import { NextResponse } from "next/server";
import { isSmtpConfigured, sendRegisterCodeEmail } from "@/lib/mail";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";
import {
  findUserByEmail,
  lastRegisterCodeAt,
  saveRegisterCode,
} from "@/lib/store";

function makeCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST(req: Request) {
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "服务器未配置 QQ SMTP（SMTP_USER / SMTP_PASS）" },
      { status: 503 },
    );
  }

  const rl = checkRateLimit(`code:${clientKeyFromRequest(req)}`, 8, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: `发送过于频繁，请 ${rl.retryAfterSec}s 后再试` },
      { status: 429 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 80) {
    return NextResponse.json({ error: "请填写有效邮箱" }, { status: 400 });
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }

  const last = await lastRegisterCodeAt(email);
  if (last && Date.now() - last < 60_000) {
    const wait = Math.ceil((60_000 - (Date.now() - last)) / 1000);
    return NextResponse.json(
      { error: `请 ${wait}s 后再获取验证码` },
      { status: 429 },
    );
  }

  const code = makeCode();
  try {
    await sendRegisterCodeEmail(email, code);
    await saveRegisterCode(email, code);
    return NextResponse.json({ ok: true, expiresInSec: 600 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `邮件发送失败：${message}` },
      { status: 502 },
    );
  }
}
