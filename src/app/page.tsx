"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Project, PublicUser } from "@/lib/types";
import { JUDGE_DEMO_PROMPT } from "@/lib/constants";

const EXAMPLES: { label: string; prompt: string }[] = [
  { label: "运维看板", prompt: JUDGE_DEMO_PROMPT },
  {
    label: "记账",
    prompt:
      "做一个简单记账页：记录收支、按分类筛选、显示本月合计，表单要有校验提示。",
  },
  {
    label: "作品集",
    prompt:
      "做一个个人作品集单页：项目卡片、技能标签、联系表单校验，风格克制专业。",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<PublicUser | null | undefined>(undefined);
  const [projects, setProjects] = useState<Project[]>([]);
  const [prompt, setPrompt] = useState(EXAMPLES[0].prompt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshUser() {
    const res = await fetch("/api/auth/me");
    const d = await res.json();
    setUser(d.user ?? null);
    return d.user as PublicUser | null;
  }

  async function refreshProjects() {
    const res = await fetch("/api/projects");
    if (res.status === 401) {
      setProjects([]);
      return;
    }
    const d = await res.json();
    setProjects(d.projects ?? []);
  }

  useEffect(() => {
    refreshUser()
      .then((u) => {
        if (u) return refreshProjects();
        setProjects([]);
      })
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setProjects([]);
    router.refresh();
  }

  async function removeProject(id: string, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("确定删除该项目？")) return;
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "删除失败");
      return;
    }
    await refreshProjects();
  }

  async function onCreate(e?: React.FormEvent) {
    e?.preventDefault();
    if (!user) {
      router.push("/login");
      return;
    }
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "创建失败");
      router.push(`/projects/${data.project.id}?autostart=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
    }
  }

  return (
    <div className="min-h-full">
      <header className="border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <div className="text-sm font-semibold tracking-tight">
            Atoms Ops Demo
          </div>
          <div className="flex items-center gap-3 text-xs text-[var(--muted)]">
            {user === undefined ? (
              <span>…</span>
            ) : user ? (
              <>
                <span>{user.name}</span>
                <button
                  type="button"
                  onClick={logout}
                  className="hover:text-[var(--text)]"
                >
                  退出
                </button>
              </>
            ) : (
              <>
                <a href="/login" className="hover:text-[var(--text)]">
                  登录
                </a>
                <a
                  href="/register"
                  className="rounded-lg bg-[var(--accent)] px-2.5 py-1 font-medium text-white"
                >
                  注册
                </a>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          自然语言生成可预览应用，支持预检与发布
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          预检 → 发布 → 回滚
        </p>

        {!user && user !== undefined && (
          <div className="mt-6 rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[var(--muted)]">
            请先{" "}
            <a href="/login" className="text-[var(--accent)]">
              登录
            </a>{" "}
            或{" "}
            <a href="/register" className="text-[var(--accent)]">
              注册
            </a>{" "}
            后再开始构建。已发布的公开页无需登录即可访问。
          </div>
        )}

        <form onSubmit={onCreate} className="mt-8 space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            placeholder="描述你想做的应用…"
            disabled={!user}
            className="w-full resize-y rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm text-[#8b95a5] outline-none placeholder:text-[#b0b8c4] focus:border-[var(--accent)] focus:text-[var(--text)] disabled:opacity-60"
          />
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex.label}
                type="button"
                onClick={() => setPrompt(ex.prompt)}
                disabled={!user}
                className="rounded-lg border border-[var(--border)] bg-white px-3 py-1 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--text)] disabled:opacity-50"
              >
                {ex.label}
              </button>
            ))}
          </div>
          {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
          <button
            type="submit"
            disabled={loading || !prompt.trim() || !user}
            className="rounded-xl bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {!user ? "请先登录" : loading ? "创建中…" : "开始构建"}
          </button>
        </form>

        <section className="mt-12">
          <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            最近项目
          </h2>
          <ul className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
            {!user && (
              <li className="px-4 py-6 text-sm text-[var(--muted)]">
                登录后可查看你的项目
              </li>
            )}
            {user && projects.length === 0 && (
              <li className="px-4 py-6 text-sm text-[var(--muted)]">
                还没有项目
              </li>
            )}
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-[var(--bg)]"
              >
                <a
                  href={`/projects/${p.id}`}
                  className="flex min-w-0 flex-1 items-center justify-between gap-3"
                >
                  <span className="min-w-0 truncate font-medium">{p.name}</span>
                  <StatusText status={p.status} />
                </a>
                <button
                  type="button"
                  onClick={(e) => removeProject(p.id, e)}
                  className="shrink-0 text-xs text-[var(--muted)] hover:text-[var(--danger)]"
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

function StatusText({ status }: { status: Project["status"] }) {
  const map: Record<Project["status"], string> = {
    draft: "草稿",
    building: "构建中",
    ready: "待发布",
    published: "已发布",
    failed: "构建失败",
  };
  const color: Record<Project["status"], string> = {
    draft: "text-[var(--muted)]",
    building: "text-[var(--info)]",
    ready: "text-[var(--accent)]",
    published: "text-[var(--ok)]",
    failed: "text-[var(--danger)]",
  };
  return (
    <span className={`shrink-0 text-xs ${color[status]}`}>{map[status]}</span>
  );
}
