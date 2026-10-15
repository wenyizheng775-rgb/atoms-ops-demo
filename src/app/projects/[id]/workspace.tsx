"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { GateResult, Project } from "@/lib/types";

export function ProjectWorkspace({ id }: { id: string }) {
  const search = useSearchParams();
  const [project, setProject] = useState<Project | null>(null);
  const [input, setInput] = useState("按环境筛选默认选中 prod，主色改成深蓝");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">(
    "desktop",
  );
  const [tab, setTab] = useState<"steps" | "files" | "audit" | "gate">("gate");
  const [autostartDone, setAutostartDone] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishResult, setPublishResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载失败");
    setProject(data.project);
    return data.project as Project;
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => {
      load().catch(() => null);
    }, 800);
    return () => clearInterval(timer);
  }, [busy, load]);

  const runGenerate = useCallback(
    async (prompt?: string) => {
      setBusy(true);
      setError(null);
      setTab("steps");
      try {
        const res = await fetch(`/api/projects/${id}/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "构建失败");
        setProject(data.project);
        setTab(data.project.lastGate ? "gate" : "steps");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        await load().catch(() => null);
      } finally {
        setBusy(false);
      }
    },
    [id, load],
  );

  useEffect(() => {
    if (!project || autostartDone || busy) return;
    if (search.get("autostart") === "1" && project.versions.length === 0) {
      setAutostartDone(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("autostart");
      window.history.replaceState({}, "", url.pathname + url.search);
      runGenerate(project.prompt);
    }
  }, [project, search, busy, autostartDone, runGenerate]);

  const currentVersion = useMemo(() => {
    if (!project?.currentVersionId) return null;
    return (
      project.versions.find((v) => v.id === project.currentVersionId) ?? null
    );
  }, [project]);

  async function confirmPublish() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "发布失败");
      setProject(data.project);
      const url = `${window.location.origin}/p/${id}`;
      setPublishResult(url);
      setPublishOpen(false);
      setTab("audit");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPublishOpen(false);
      setTab("gate");
    } finally {
      setBusy(false);
    }
  }

  async function onRollback(versionId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}/rollback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "回滚失败");
      setProject(data.project);
      setTab("audit");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!project) {
    return (
      <div className="flex min-h-full items-center justify-center text-sm text-[var(--muted)]">
        {error || "加载项目中…"}
      </div>
    );
  }

  const widthClass =
    viewport === "mobile"
      ? "max-w-[390px]"
      : viewport === "tablet"
        ? "max-w-[768px]"
        : "max-w-none";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--bg)]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-white px-4">
        <a href="/" className="text-xs text-[var(--muted)] hover:text-[var(--text)]">
          ← 控制台
        </a>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{project.name}</div>
          <div className="text-[11px] text-[var(--muted)]">
            {project.status}
            {currentVersion ? ` · ${currentVersion.label}` : ""}
            {project.publishedVersionId ? " · 已发布" : ""}
          </div>
        </div>
        <div className="hidden items-center gap-1 rounded-lg border border-[var(--border)] p-1 sm:flex">
          {(["desktop", "tablet", "mobile"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewport(v)}
              className={`rounded-md px-2 py-1 text-[11px] ${
                viewport === v ? "bg-[var(--accent-dim)] text-[var(--accent)]" : "text-[var(--muted)]"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {project.currentVersionId && (
          <a
            href={`/api/projects/${project.id}/preview?v=${project.currentVersionId}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            预览
          </a>
        )}
        {project.publishedVersionId && (
          <a
            href={`/p/${project.id}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            公开页
          </a>
        )}
        <button
          disabled={busy || !project.currentVersionId || !project.lastGate?.ok}
          onClick={() => setPublishOpen(true)}
          className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          title={!project.lastGate?.ok ? "门禁未通过时不可发布" : "发布前复检"}
        >
          发布
        </button>
      </header>

      {publishResult && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--ok)]/30 bg-[#ecfdf3] px-4 py-3 text-sm">
          <span className="font-medium text-[var(--ok)]">发布成功</span>
          <code className="rounded bg-white px-2 py-1 text-xs">{publishResult}</code>
          <button
            type="button"
            onClick={() => copyUrl(publishResult)}
            className="rounded-lg bg-[var(--ok)] px-3 py-1 text-xs font-medium text-white"
          >
            {copied ? "已复制" : "复制链接"}
          </button>
          <a
            href={publishResult}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[var(--ok)] underline"
          >
            新窗口打开
          </a>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="flex max-h-[46vh] min-h-0 w-full shrink-0 flex-col border-b border-[var(--border)] bg-white md:max-h-none md:w-[400px] md:border-b-0 md:border-r">
          <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] p-2">
            {(
              [
                ["gate", "门禁"],
                ["steps", "步骤"],
                ["files", "文件"],
                ["audit", "审计"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`rounded-md px-3 py-1.5 text-xs whitespace-nowrap ${
                  tab === k
                    ? "bg-[var(--accent-dim)] font-medium text-[var(--accent)]"
                    : "text-[var(--muted)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "gate" && (
              <GatePanel
                gate={project.lastGate}
                onPublish={() => setPublishOpen(true)}
                canPublish={Boolean(
                  project.currentVersionId && project.lastGate?.ok && !busy,
                )}
              />
            )}

            {tab === "steps" && (
              <div className="space-y-2">
                <p className="text-[11px] text-[var(--muted)]">
                  「编排」为流程演出；「真实」含 LLM / Gate / 持久化 / 发布副作用。
                </p>
                {project.steps.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-xl border border-[var(--border)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-sm font-medium">{s.title}</div>
                      <div className="flex items-center gap-1">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] ${
                            s.reality === "live"
                              ? "bg-[#ecfdf3] text-[var(--ok)]"
                              : "bg-[#f2f4f7] text-[var(--staged)]"
                          }`}
                        >
                          {s.reality === "live" ? "真实" : "编排"}
                        </span>
                        <span
                          className={`text-[11px] ${
                            s.status === "done"
                              ? "text-[var(--ok)]"
                              : s.status === "failed"
                                ? "text-[var(--danger)]"
                                : "text-[var(--info)]"
                          }`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                    {s.detail && (
                      <pre className="mt-2 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--muted)]">
                        {s.detail}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {tab === "files" && (
              <div className="space-y-2">
                {!currentVersion && (
                  <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
                    尚无产物文件。先完成一次通过门禁的构建。
                  </div>
                )}
                {(currentVersion?.files ?? []).map((f) => (
                  <div
                    key={f.path}
                    className="rounded-lg border border-[var(--border)] px-3 py-2"
                  >
                    <div className="font-mono text-xs">{f.path}</div>
                    <div className="text-[11px] text-[var(--muted)]">{f.note}</div>
                  </div>
                ))}
                {(project.releases?.length ?? 0) > 0 && (
                  <div className="pt-3">
                    <div className="mb-2 text-[11px] font-medium text-[var(--muted)]">
                      已发布快照（不可变）
                    </div>
                    {[...(project.releases ?? [])].reverse().map((r) => (
                      <button
                        key={r.id}
                        disabled={busy}
                        onClick={() => onRollback(r.versionId)}
                        className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-xs ${
                          r.versionId === project.currentVersionId
                            ? "border-[var(--accent)] bg-[var(--accent-ink)]"
                            : "border-[var(--border)]"
                        }`}
                      >
                        <div className="flex justify-between">
                          <span className="font-medium">{r.label}</span>
                          <span className="text-[var(--accent)]">回滚到此</span>
                        </div>
                        <div className="mt-1 text-[var(--muted)]">
                          {new Date(r.createdAt).toLocaleString()} · {r.publicPath}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="pt-3">
                  <div className="mb-2 text-[11px] font-medium text-[var(--muted)]">
                    全部生成版本
                  </div>
                  {project.versions.length === 0 && (
                    <p className="text-xs text-[var(--muted)]">暂无版本</p>
                  )}
                  {project.versions.map((v) => (
                    <button
                      key={v.id}
                      disabled={busy}
                      onClick={() => onRollback(v.id)}
                      className={`mb-2 block w-full rounded-lg border px-3 py-2 text-left text-xs ${
                        v.id === project.currentVersionId
                          ? "border-[var(--accent)] bg-[var(--accent-ink)]"
                          : "border-[var(--border)]"
                      }`}
                    >
                      <div className="flex justify-between">
                        <span className="font-medium">{v.label}</span>
                        <span className="text-[var(--accent)]">切换到此</span>
                      </div>
                      <div className="mt-1 truncate text-[var(--muted)]">
                        {v.prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {tab === "audit" && (
              <div className="space-y-2">
                {[...project.audit].reverse().map((a) => (
                  <div
                    key={a.id}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      a.highlight
                        ? "border-[var(--accent)] bg-[var(--accent-ink)]"
                        : "border-[var(--border)]"
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-semibold uppercase tracking-wide text-[var(--accent)]">
                        {a.action}
                        {a.highlight ? " · 关键点" : ""}
                      </span>
                      <span className="text-[var(--muted)]">
                        {new Date(a.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-1 text-[var(--muted)]">{a.detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            className="border-t border-[var(--border)] p-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!input.trim() || busy) return;
              runGenerate(input.trim());
            }}
          >
            {error && (
              <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>
            )}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              disabled={busy}
              placeholder="迭代需求，例如：按环境筛选默认 prod，主色改深蓝"
              className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[#8b95a5] outline-none placeholder:text-[#b0b8c4] focus:border-[var(--accent)] focus:text-[var(--text)]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="mt-2 w-full rounded-xl border border-[var(--border)] py-2 text-sm font-medium disabled:opacity-40"
            >
              {busy ? "执行中…" : "提交迭代"}
            </button>
          </form>
        </aside>

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col p-3">
          <div className="mb-2 flex shrink-0 items-center justify-between text-[11px] text-[var(--muted)]">
            <span>产物预览 · Artifact Sandbox</span>
            <span>{currentVersion ? currentVersion.label : "等待产物"}</span>
          </div>
          <div className="mx-auto min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-sm">
            <div className={`mx-auto h-full ${widthClass}`}>
              {project.currentVersionId ? (
                <iframe
                  key={project.currentVersionId}
                  title="preview"
                  className="h-full w-full bg-white"
                  sandbox="allow-scripts allow-forms"
                  src={`/api/projects/${project.id}/preview?v=${project.currentVersionId}`}
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-[var(--muted)]">
                  {busy ? "Builder 真实调用中…" : "尚无预览（门禁失败时不会写入版本）"}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      {publishOpen && (
        <PublishModal
          gate={project.lastGate}
          versionLabel={currentVersion?.label ?? "current"}
          publicPath={`/p/${project.id}`}
          busy={busy}
          onClose={() => setPublishOpen(false)}
          onConfirm={confirmPublish}
        />
      )}
    </div>
  );
}

function GatePanel({
  gate,
  onPublish,
  canPublish,
}: {
  gate: GateResult | null;
  onPublish: () => void;
  canPublish: boolean;
}) {
  if (!gate) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border)] p-4 text-sm text-[var(--muted)]">
        尚无门禁结果。完成一次构建后，这里会列出基于实际产物的确定性检查。
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div
        className={`rounded-xl border px-3 py-2 text-sm font-medium ${
          gate.ok
            ? "border-[#abefc6] bg-[#ecfdf3] text-[var(--ok)]"
            : "border-[#fecdca] bg-[#fef3f2] text-[var(--danger)]"
        }`}
      >
        {gate.ok
          ? "门禁通过 · 可保存公开 Demo 版本"
          : "门禁阻断 · 禁止发布"}
        {gate.at && (
          <div className="mt-1 text-[11px] font-normal opacity-80">
            {new Date(gate.at).toLocaleString()}
          </div>
        )}
      </div>
      {!gate.ok && gate.hint && (
        <div className="rounded-xl border border-[var(--warn)]/40 bg-[#fffbeb] px-3 py-2 text-xs text-[var(--warn)]">
          修复建议：{gate.hint}
        </div>
      )}
      {gate.checks.map((c) => (
        <div
          key={c.id}
          className="rounded-xl border border-[var(--border)] px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{c.name}</span>
            <span
              className={`text-xs font-semibold ${
                c.passed ? "text-[var(--ok)]" : "text-[var(--danger)]"
              }`}
            >
              {c.passed ? "PASS" : "BLOCK"}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--muted)]">{c.message}</div>
        </div>
      ))}
      <button
        type="button"
        disabled={!canPublish}
        onClick={onPublish}
        className="w-full rounded-xl bg-[var(--accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-40"
      >
        {gate.ok ? "发布公开 Demo 版本…" : "存在阻断项，无法发布"}
      </button>
      <p className="text-[11px] text-[var(--muted)]">
        「发布」= 保存不可变快照并开放 /p/:id 预览，不是生产集群部署。
      </p>
    </div>
  );
}

function PublishModal({
  gate,
  versionLabel,
  publicPath,
  busy,
  onClose,
  onConfirm,
}: {
  gate: GateResult | null;
  versionLabel: string;
  publicPath: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-base font-semibold">发布确认</h3>
        <p className="mt-1 text-sm text-[var(--muted)]">
          将再次跑 Gatekeeper 复检，通过后发布 {versionLabel} 到{" "}
          <code>{publicPath}</code>
        </p>
        <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[var(--border)] p-3 text-xs">
          {(gate?.checks ?? []).map((c) => (
            <div key={c.id} className="flex justify-between gap-2">
              <span>{c.name}</span>
              <span className={c.passed ? "text-[var(--ok)]" : "text-[var(--danger)]"}>
                {c.passed ? "PASS" : "BLOCK"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            disabled={busy || !gate?.ok}
            onClick={onConfirm}
            className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {busy ? "发布中…" : "确认放行"}
          </button>
        </div>
      </div>
    </div>
  );
}
