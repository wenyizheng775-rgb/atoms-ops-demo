import { randomUUID } from "crypto";
import type { Project } from "./types";
import { runGateChecks } from "./gatekeeper";
import {
  GATE_DEMO_ID,
  JUDGE_DEMO_PROMPT,
  SHOWCASE_ID,
} from "./constants";

export { GATE_DEMO_ID, JUDGE_DEMO_PROMPT, SHOWCASE_ID };
const SHOWCASE_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>值班看板 · Showcase</title>
<style>
  :root { --bg:#f4f6f8; --card:#fff; --line:#d8dee6; --text:#1a2332; --muted:#5c6b7a; --ok:#1f7a4c; --warn:#a16207; --bad:#b42318; --accent:#1d4ed8; }
  * { box-sizing:border-box; }
  body { margin:0; font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif; background:var(--bg); color:var(--text); }
  header { display:flex; justify-content:space-between; align-items:center; padding:16px 20px; border-bottom:1px solid var(--line); background:var(--card); }
  h1 { font-size:16px; margin:0; font-weight:650; }
  .muted { color:var(--muted); font-size:12px; }
  main { padding:20px; max-width:960px; margin:0 auto; }
  .filters { display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; }
  .filters button { border:1px solid var(--line); background:#fff; padding:6px 12px; border-radius:8px; cursor:pointer; font-size:13px; }
  .filters button.active { border-color:var(--accent); color:var(--accent); background:#eff6ff; }
  .grid { display:grid; gap:12px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .row { display:flex; justify-content:space-between; gap:12px; align-items:center; }
  .badge { font-size:11px; padding:2px 8px; border-radius:999px; border:1px solid var(--line); }
  .ok { color:var(--ok); border-color:#b7e0c5; background:#ecfdf3; }
  .warn { color:var(--warn); border-color:#f5d08a; background:#fffbeb; }
  .bad { color:var(--bad); border-color:#f3b4b0; background:#fef3f2; }
  .detail { display:none; margin-top:10px; padding-top:10px; border-top:1px dashed var(--line); font-size:13px; color:var(--muted); }
  .card.open .detail { display:block; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  th, td { text-align:left; padding:8px 6px; border-bottom:1px solid var(--line); }
  th { color:var(--muted); font-weight:500; }
</style>
</head>
<body>
<header>
  <div>
    <h1>运维值班看板</h1>
    <div class="muted">示例项目</div>
  </div>
  <div class="muted">SLO 汇总 99.95% · 3 服务健康</div>
</header>
<main>
  <div class="filters" id="filters">
    <button class="active" data-env="all">全部环境</button>
    <button data-env="prod">prod</button>
    <button data-env="staging">staging</button>
  </div>
  <div class="grid" id="services"></div>
  <div class="card" style="margin-top:16px">
    <div class="row"><strong>最近发布</strong><span class="muted">审计可读</span></div>
    <table>
      <thead><tr><th>时间</th><th>服务</th><th>版本</th><th>结果</th></tr></thead>
      <tbody>
        <tr><td>10:12</td><td>api-gateway</td><td>v2.4.1</td><td><span class="badge ok">成功</span></td></tr>
        <tr><td>09:40</td><td>billing-worker</td><td>v1.9.0</td><td><span class="badge warn">金丝雀</span></td></tr>
        <tr><td>08:55</td><td>ops-console</td><td>v0.3.2</td><td><span class="badge ok">成功</span></td></tr>
      </tbody>
    </table>
  </div>
</main>
<script>
const data = [
  { name:'api-gateway', env:'prod', slo:'99.98%', status:'ok', note:'最近发布 v2.4.1，预检全绿，无回滚。' },
  { name:'billing-worker', env:'staging', slo:'99.20%', status:'warn', note:'错误率升高，已挂起全量，等待 Gate 复检。' },
  { name:'ops-console', env:'prod', slo:'99.99%', status:'ok', note:'静态资源发布，CDN 已刷新。' },
  { name:'agent-runner', env:'staging', slo:'99.05%', status:'ok', note:'推理超时已恢复，金丝雀通过。' },
];
const root = document.getElementById('services');
let env = 'all';
function render() {
  root.innerHTML = '';
  data.filter(d => env==='all' || d.env===env).forEach(d => {
    const el = document.createElement('div');
    el.className = 'card';
    el.innerHTML = \`<div class="row">
      <div><strong>\${d.name}</strong> <span class="muted">· \${d.env}</span></div>
      <span class="badge \${d.status}">SLO \${d.slo}</span>
    </div><div class="detail">\${d.note}</div>\`;
    el.onclick = () => el.classList.toggle('open');
    root.appendChild(el);
  });
}
document.getElementById('filters').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  env = b.dataset.env; [...document.querySelectorAll('#filters button')].forEach(x=>x.classList.toggle('active', x===b));
  render();
};
render();
</script>
</body>
</html>`;

/** 故意缺少闭合 html，用于演示门禁拦截（入库前会被 normalize，故用远程脚本触发真实拦截） */
const GATE_FAIL_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8" /><title>Gate Demo</title>
<script src="https://evil.example.com/x.js"></script>
</head>
<body><h1>故意触发远程脚本拦截</h1><p>此项目用于演示 Gatekeeper 阻断。</p></body>
</html>`;

export function buildShowcaseProject(): Project {
  const now = new Date().toISOString();
  const v1 = {
    id: "11111111-1111-4111-8111-111111111111",
    label: "v1",
    html: SHOWCASE_HTML,
    prompt: JUDGE_DEMO_PROMPT,
    createdAt: now,
    files: [
      { path: "DESIGN.md", note: "运维值班看板规格" },
      { path: "index.html", note: "Artifact Sandbox 产物" },
      { path: "gate-report.json", note: "预检通过" },
    ],
  };
  const gate = runGateChecks(SHOWCASE_HTML);
  return {
    id: SHOWCASE_ID,
    name: "运维值班看板（示例）",
    prompt: JUDGE_DEMO_PROMPT,
    status: "published",
    tag: "showcase",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: randomUUID(),
        role: "user",
        content: JUDGE_DEMO_PROMPT,
        createdAt: now,
      },
      {
        id: randomUUID(),
        role: "assistant",
        content: "已生成并发布。可在门禁查看预检，或打开公开页 / 回滚版本。",
        createdAt: now,
      },
    ],
    steps: [
      {
        id: randomUUID(),
        kind: "gate",
        title: "Gatekeeper · 发布预检",
        detail: gate.checks
          .map((c) => `${c.passed ? "✓" : "✗"} ${c.name}: ${c.message}`)
          .join("\n"),
        status: "done",
        reality: "live",
        createdAt: now,
      },
      {
        id: randomUUID(),
        kind: "publish",
        title: "Publisher · 一键发布",
        detail: `已发布 v1 → /p/${SHOWCASE_ID}`,
        status: "done",
        reality: "live",
        createdAt: now,
      },
    ],
    versions: [v1],
    releases: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        versionId: v1.id,
        label: "v1",
        createdAt: now,
        publicPath: `/p/${SHOWCASE_ID}`,
      },
    ],
    currentVersionId: v1.id,
    publishedVersionId: v1.id,
    lastGate: { ...gate, at: now },
    audit: [
      {
        id: randomUUID(),
        action: "create",
        detail: "预置 Showcase 项目",
        createdAt: now,
      },
      {
        id: randomUUID(),
        action: "generate",
        detail: "生成 v1（预置）",
        createdAt: now,
        meta: { versionId: v1.id },
      },
      {
        id: randomUUID(),
        action: "publish",
        detail: "发布 v1",
        createdAt: now,
        meta: { versionId: v1.id },
        highlight: true,
      },
    ],
  };
}

export function buildGateDemoProject(): Project {
  const now = new Date().toISOString();
  const gate = runGateChecks(GATE_FAIL_HTML);
  return {
    id: GATE_DEMO_ID,
    name: "外部脚本预检失败（示例）",
    prompt: "引入外部 script 的页面（用于查看预检阻断结果）",
    status: "failed",
    tag: "gate-demo",
    createdAt: now,
    updatedAt: now,
    messages: [
      {
        id: randomUUID(),
        role: "system",
        content: "预检未通过：检测到外部 script，产物未入库。详见门禁面板。",
        createdAt: now,
      },
    ],
    steps: [
      {
        id: randomUUID(),
        kind: "gate",
        title: "Gatekeeper · 发布预检",
        detail: gate.checks
          .map((c) => `${c.passed ? "✓" : "✗"} ${c.name}: ${c.message}`)
          .join("\n"),
        status: "failed",
        reality: "live",
        createdAt: now,
      },
    ],
    versions: [],
    releases: [],
    currentVersionId: null,
    publishedVersionId: null,
    lastGate: { ...gate, at: now },
    audit: [
      {
        id: randomUUID(),
        action: "generate",
        detail: "Gatekeeper 预检失败（示例）",
        createdAt: now,
        highlight: true,
      },
    ],
  };
}
