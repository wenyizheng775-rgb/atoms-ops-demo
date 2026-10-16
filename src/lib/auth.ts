import { randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { userFromSession } from "./store";
import type { PublicUser } from "./types";

const scryptAsync = promisify(scrypt);
const COOKIE = "atoms_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 32)) as Buffer;
  return `${salt}:${buf.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const buf = (await scryptAsync(password, salt, 32)) as Buffer;
  const hashBuf = Buffer.from(hash, "hex");
  if (buf.length !== hashBuf.length) return false;
  return timingSafeEqual(buf, hashBuf);
}

export function sessionIdFromRequest(req: Request): string | null {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)atoms_session=([^;]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export async function getCurrentUser(req: Request): Promise<PublicUser | null> {
  return userFromSession(sessionIdFromRequest(req));
}

export function attachSession(res: NextResponse, sessionId: string): void {
  res.cookies.set(COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 14 * 24 * 60 * 60,
  });
}

export function clearSession(res: NextResponse): void {
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
