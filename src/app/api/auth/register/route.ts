import { NextResponse } from "next/server";
import { attachSession, hashPassword } from "@/lib/auth";
import { isSmtpConfigured } from "@/lib/mail";
import {
  consumeRegisterCode,
  createSession,
  createUser,
  findUserByEmail,
  toPublicUser,
} from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    email?: string;
    password?: string;
    code?: string;
  };
  const name = body.name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const code = body.code?.trim() ?? "";

  if (name.length < 1 || name.length > 20) {
    return NextResponse.json({ error: "姓名长度为 1–20 个字符" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 80) {
    return NextResponse.json({ error: "请填写有效邮箱" }, { status: 400 });
  }
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "请填写 6 位邮箱验证码" }, { status: 400 });
  }
  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "服务器未配置 QQ SMTP，暂无法邮箱验证注册" },
      { status: 503 },
    );
  }
  if (await findUserByEmail(email)) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }
  if (!(await consumeRegisterCode(email, code))) {
    return NextResponse.json(
      { error: "验证码错误或已过期，请重新获取" },
      { status: 400 },
    );
  }

  try {
    const user = await createUser({
      name,
      email,
      passwordHash: await hashPassword(password),
    });
    const session = await createSession(user.id);
    const res = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
    attachSession(res, session.id);
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const status = message.includes("已注册") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
