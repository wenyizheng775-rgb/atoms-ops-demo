import {
  BUILD_SYSTEM,
  REVISE_SYSTEM,
  buildReviseUserPrompt,
  chatCompletion,
  extractHtml,
  isVisualOverhaulRequest,
} from "./deepseek";
import { normalizeHtml, runGateChecks } from "./gatekeeper";
import {
  getProject,
  makeAudit,
  makeMessage,
  makeStep,
  makeVersion,
  saveProject,
} from "./store";
import type { AgentStep, ArtifactVersion, Project, ReleaseRecord } from "./types";
import { randomUUID } from "crypto";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mark(
  project: Project,
  step: AgentStep,
  status: AgentStep["status"],
  detail?: string,
) {
  step.status = status;
  if (detail) step.detail = detail;
  project.steps = [...project.steps];
  await saveProject(project);
}

export async function runBuildPipeline(
  projectId: string,
  userPrompt: string,
  mode: "create" | "revise",
): Promise<Project> {
  let project = await getProject(projectId);
  if (!project) throw new Error("Project not found");

  project.status = "building";
  if (mode === "revise") {
    project.messages.push(makeMessage("user", userPrompt));
  }
  project.steps = [];
  await saveProject(project);

  const phasePlan = makeStep({
    kind: "plan",
    title: "Orchestrator · 拆解任务",
    detail:
      mode === "create"
        ? "识别页面结构、交互与发布前置条件"
        : "识别增量变更范围与回归风险",
    status: "running",
    reality: "staged",
  });
  project.steps.push(phasePlan);
  await saveProject(project);
  await sleep(280);
  await mark(
    project,
    phasePlan,
    "done",
    mode === "create"
      ? "计划：DESIGN → 产物生成(真实) → Gate 预检(真实) → 版本写入(真实)"
      : "计划：读取当前版本 → 增量修改(真实) → Gate 预检(真实) → 新版本(真实)",
  );

  const readStep = makeStep({
    kind: "read",
    title: "读取上下文 / 当前产物",
    status: "running",
    reality: "staged",
  });
  project.steps.push(readStep);
  await saveProject(project);
  await sleep(200);

  const current = project.versions.find((v) => v.id === project.currentVersionId);
  await mark(
    project,
    readStep,
    "done",
    current
      ? `已加载版本 ${current.label}（${current.files.length} 个逻辑文件）`
      : "无历史版本，按空白工作区初始化",
  );

  const designStep = makeStep({
    kind: "write",
    title: "写入 DESIGN.md",
    status: "running",
    reality: "staged",
  });
  project.steps.push(designStep);
  await saveProject(project);

  const designNote =
    mode === "create"
      ? `目标：${userPrompt.slice(0, 120)}\n约束：单页 HTML 沙箱、可交互、可发布预检`
      : `变更：${userPrompt}\n基线版本：${current?.label ?? "none"}`;

  await sleep(180);
  await mark(project, designStep, "done", designNote);

  const buildStep = makeStep({
    kind: "write",
    title: "Builder · 调用 DeepSeek 生成产物",
    detail: "真实 LLM 调用中…",
    status: "running",
    reality: "live",
  });
  project.steps.push(buildStep);
  await saveProject(project);

  let html: string;
  try {
    const visual = isVisualOverhaulRequest(userPrompt);
    const raw =
      mode === "revise" && current
        ? await chatCompletion({
            system: REVISE_SYSTEM,
            user: buildReviseUserPrompt(userPrompt, current.html),
            temperature: visual ? 0.75 : 0.45,
          })
        : await chatCompletion({
            system: BUILD_SYSTEM,
            user: userPrompt,
            temperature: visual ? 0.7 : 0.5,
          });
    html = normalizeHtml(extractHtml(raw));
    await mark(
      project,
      buildStep,
      "done",
      `真实调用完成 · index.html ${(Buffer.byteLength(html, "utf-8") / 1024).toFixed(1)} KB${
        visual ? " · 视觉大改" : ""
      }`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await mark(project, buildStep, "failed", message);
    project.status = "failed";
    project.lastGate = null;
    project.messages.push(makeMessage("assistant", `构建失败：${message}`));
    project.audit.push(makeAudit("generate", `生成失败：${message}`));
    return saveProject(project);
  }

  const gate = runGateChecks(html);
  project.lastGate = { ...gate, at: new Date().toISOString() };

  const gateStep = makeStep({
    kind: "gate",
    title: "Gatekeeper · 真实预检",
    status: "running",
    reality: "live",
  });
  project.steps.push(gateStep);
  await saveProject(project);

  const gateDetail = gate.checks
    .map((c) => `${c.passed ? "✓" : "✗"} ${c.name}: ${c.message}`)
    .join("\n");

  if (!gate.ok) {
    await mark(project, gateStep, "failed", gateDetail);
    const hint = gate.hint ? `\n修复建议：${gate.hint}` : "";
    // 新版本未入库；若已有有效版本，门禁面板恢复为当前版本的检查结果，避免误锁发布
    if (project.currentVersionId) {
      const cur = project.versions.find(
        (v) => v.id === project.currentVersionId,
      );
      if (cur) {
        const curGate = runGateChecks(cur.html);
        project.lastGate = { ...curGate, at: new Date().toISOString() };
      }
      project.status = "ready";
    } else {
      project.lastGate = { ...gate, at: new Date().toISOString() };
      project.status = "failed";
    }
    project.messages.push(
      makeMessage(
        "assistant",
        `本次生成未通过门禁，新版本未写入${
          project.currentVersionId ? "，仍保留上一有效预览" : ""
        }。\n${gateDetail}${hint}`,
      ),
    );
    project.audit.push(
      makeAudit("generate", "Gatekeeper 预检失败", undefined, true),
    );
    return saveProject(project);
  }

  await mark(project, gateStep, "done", gateDetail);

  const versionIndex = project.versions.length + 1;
  const version = makeVersion({
    label: `v${versionIndex}`,
    html,
    prompt: userPrompt,
    files: [
      { path: "DESIGN.md", note: "需求与约束说明" },
      { path: "index.html", note: "可预览单页产物（Artifact Sandbox）" },
      { path: "gate-report.json", note: "发布预检结果" },
    ],
  });

  const writeStep = makeStep({
    kind: "write",
    title: "版本写入 · store.json",
    detail: `真实持久化 ${version.label}`,
    status: "running",
    reality: "live",
  });
  project.steps.push(writeStep);

  project.versions.push(version);
  project.currentVersionId = version.id;
  project.status = "ready";
  project.messages.push(
    makeMessage(
      "assistant",
      mode === "create"
        ? `${version.label} 已通过门禁。下一步：在门禁面板确认 checks → 点击「发布」。`
        : `${version.label} 已通过门禁。可发布，或在「文件」页回滚旧版本。`,
    ),
  );
  project.audit.push(
    makeAudit("generate", `生成 ${version.label}`, {
      versionId: version.id,
    }),
  );
  await mark(project, writeStep, "done", `${version.label} 已写入持久化存储`);
  return saveProject(project);
}

export async function publishProject(projectId: string): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");
  if (!project.currentVersionId) throw new Error("没有可发布的版本");

  const version = project.versions.find(
    (v) => v.id === project.currentVersionId,
  );
  if (!version) throw new Error("当前版本不存在");

  const gate = runGateChecks(version.html);
  project.lastGate = { ...gate, at: new Date().toISOString() };

  const gateStep = makeStep({
    kind: "gate",
    title: "发布前复检（真实）",
    status: gate.ok ? "done" : "failed",
    reality: "live",
    detail: gate.checks
      .map((c) => `${c.passed ? "✓" : "✗"} ${c.name}: ${c.message}`)
      .join("\n"),
  });
  project.steps.push(gateStep);

  if (!gate.ok) {
    const hint = gate.hint ? ` 修复建议：${gate.hint}` : "";
    project.audit.push(
      makeAudit("publish", "发布被 Gatekeeper 阻断", undefined, true),
    );
    await saveProject(project);
    throw new Error(`Gatekeeper 预检未通过，已阻断发布。${hint}`);
  }

  if (!project.releases) project.releases = [];
  const release: ReleaseRecord = {
    id: randomUUID(),
    versionId: version.id,
    label: version.label,
    createdAt: new Date().toISOString(),
    publicPath: `/p/${project.id}`,
  };
  project.releases.push(release);
  project.publishedVersionId = version.id;
  project.status = "published";
  project.steps.push(
    makeStep({
      kind: "publish",
      title: "Publisher · 保存可访问 Demo 版本（真实）",
      detail: `已发布快照 ${version.label} → ${release.publicPath}（非生产 CDN，为本站公开预览）`,
      status: "done",
      reality: "live",
    }),
  );
  project.audit.push(
    makeAudit(
      "publish",
      `发布 ${version.label} → ${release.publicPath}`,
      { versionId: version.id, releaseId: release.id },
      true,
    ),
  );
  project.messages.push(
    makeMessage(
      "assistant",
      `发布成功：公开 Demo 页 ${release.publicPath}。可回滚到历史发布快照。`,
    ),
  );
  return saveProject(project);
}

export async function rollbackProject(
  projectId: string,
  versionId: string,
): Promise<Project> {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");

  const version = project.versions.find((v) => v.id === versionId);
  if (!version) throw new Error("版本不存在");

  project.currentVersionId = version.id;
  const wasPublished = Boolean(
    project.releases?.some((r) => r.versionId === versionId) ||
      project.publishedVersionId,
  );
  if (wasPublished || project.publishedVersionId) {
    project.publishedVersionId = version.id;
    project.status = "published";
  } else {
    project.status = "ready";
  }
  project.steps.push(
    makeStep({
      kind: "publish",
      title: "Rollback · 回滚（真实）",
      detail: `当前指针 → ${version.label}；预览已切换为该版本 HTML 快照`,
      status: "done",
      reality: "live",
    }),
  );
  project.audit.push(
    makeAudit(
      "rollback",
      `回滚到 ${version.label}`,
      { versionId: version.id },
      true,
    ),
  );
  project.messages.push(
    makeMessage(
      "assistant",
      `已回滚到 ${version.label}。预览显示该版本实际内容。`,
    ),
  );
  return saveProject(project);
}

export function getCurrentHtml(project: Project): string | null {
  const id = project.currentVersionId;
  if (!id) return null;
  return project.versions.find((v) => v.id === id)?.html ?? null;
}

export function getPublishedVersion(
  project: Project,
): ArtifactVersion | null {
  if (!project.publishedVersionId) return null;
  return (
    project.versions.find((v) => v.id === project.publishedVersionId) ?? null
  );
}
