"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type Mode = "login" | "register";

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const search = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    if (sending || cooldown > 0) return;
    setError(null);
    setHint(null);
    if (!email.trim()) {
      setError("请先填写邮箱");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "发送失败");
      setHint("验证码已发送，请查收邮箱（含垃圾箱）");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            mode === "login"
              ? { email, password }
              : { name, email, password, code },
          ),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "请求失败");
      const next = search.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm px-6 py-16">
      <a href="/" className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
        ← Atoms Ops Demo
      </a>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight">
        {mode === "login" ? "登录" : "注册"}
      </h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        {mode === "login"
          ? "登录后可创建项目、预检与发布。"
          : "注册需邮箱验证码（QQ SMTP），验证邮箱归属后再建账号。"}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-3">
        {mode === "register" && (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="姓名"
            required
            maxLength={20}
            className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        )}
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="邮箱"
          required
          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
        />
        {mode === "register" && (
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="6 位验证码"
              required
              inputMode="numeric"
              maxLength={6}
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={sendCode}
              disabled={sending || cooldown > 0}
              className="shrink-0 rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs font-medium text-[var(--text)] disabled:opacity-50"
            >
              {sending
                ? "发送中…"
                : cooldown > 0
                  ? `${cooldown}s`
                  : "获取验证码"}
            </button>
          </div>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === "register" ? "密码（至少 6 位）" : "密码"}
          required
          minLength={6}
          className="w-full rounded-xl border border-[var(--border)] bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--accent)]"
        />
        {hint && <p className="text-sm text-[var(--ok)]">{hint}</p>}
        {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading
            ? mode === "login"
              ? "登录中…"
              : "注册中…"
            : mode === "login"
              ? "登录"
              : "注册"}
        </button>
      </form>

      <p className="mt-6 text-sm text-[var(--muted)]">
        {mode === "login" ? (
          <>
            还没有账号？{" "}
            <a href="/register" className="text-[var(--accent)]">
              注册
            </a>
          </>
        ) : (
          <>
            已有账号？{" "}
            <a href="/login" className="text-[var(--accent)]">
              登录
            </a>
          </>
        )}
      </p>
    </div>
  );
}
