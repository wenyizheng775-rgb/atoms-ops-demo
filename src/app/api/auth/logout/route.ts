import { NextResponse } from "next/server";
import { clearSession, sessionIdFromRequest } from "@/lib/auth";
import { deleteSession } from "@/lib/store";

export async function POST(req: Request) {
  const id = sessionIdFromRequest(req);
  if (id) await deleteSession(id);
  const res = NextResponse.json({ ok: true });
  clearSession(res);
  return res;
}
