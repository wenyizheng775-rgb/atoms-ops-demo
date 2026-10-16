import { NextResponse } from "next/server";
import { attachSession, verifyPassword } from "@/lib/auth";
import { createSession, findUserByEmail, toPublicUser } from "@/lib/store";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    password?: string;
  };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const user = email ? await findUserByEmail(email) : null;
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }
  const session = await createSession(user.id);
  const res = NextResponse.json({ user: toPublicUser(user) });
  attachSession(res, session.id);
  return res;
}
