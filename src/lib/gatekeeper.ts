import type { GateCheck, GateResult } from "./types";

const SLO_MIN = Number(process.env.GATE_SLO_MIN || 99);

/** 自动补全残缺 HTML */
export function normalizeHtml(input: string): string {
  let html = input.trim();
  if (!html) return html;

  html = html.replace(/^```html\s*/i, "").replace(/```$/i, "").trim();

  const hasDoctype = /<!doctype html>/i.test(html);
  const hasHtmlClose = /<\/html>/i.test(html);
  const hasHtmlOpen = /<html[\s>]/i.test(html);

  if (hasDoctype && hasHtmlOpen && hasHtmlClose) {
    return html;
  }

  if (!hasDoctype && hasHtmlOpen && hasHtmlClose) {
    return `<!DOCTYPE html>\n${html}`;
  }

  const body = /<body[\s>][\s\S]*<\/body>/i.test(html)
    ? html
    : `<body>\n${html}\n</body>`;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Generated App</title>
</head>
${body}
</html>`;
}

function isOpsLike(html: string): boolean {
  return /SLO|值班|staging|发布记录|运维/i.test(html);
}

function extractSloPercents(html: string): number[] {
  const out: number[] = [];
  const re = /(?:SLO[^0-9%]{0,24})?(\d{2,3}(?:\.\d{1,2})?)\s*%/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const n = Number(m[1]);
    if (n >= 50 && n <= 100) out.push(n);
  }
  return out;
}

function hasInteractable(html: string): boolean {
  return /<button\b|<select\b|type=["']submit["']|onclick=|addEventListener\s*\(|<a\s+[^>]*href=["']#/i.test(
    html,
  );
}

function fixHint(checks: GateCheck[]): string {
  const failed = checks.filter((c) => !c.passed);
  if (!failed.length) return "";
  const hints: string[] = [];
  for (const c of failed) {
    if (c.id === "no-script-remote")
      hints.push("去掉外部 <script src>，改为内联 script");
    else if (c.id === "doctype")
      hints.push("输出完整 <!DOCTYPE html>…</html> 文档");
    else if (c.id === "interactive")
      hints.push("增加可点击交互（筛选按钮/表单/锚点）");
    else if (c.id === "ops-slo")
      hints.push(`将运维看板中过低的 SLO 提升到 ≥ ${SLO_MIN}%`);
    else if (c.id === "size") hints.push("精简 HTML/CSS，控制体积");
    else hints.push(c.message);
  }
  return hints.join("；");
}

/** 确定性规则预检 — 非固定 PASS */
export function runGateChecks(html: string): GateResult {
  const normalized = normalizeHtml(html);
  const sizeKb = Buffer.byteLength(normalized, "utf-8") / 1024;
  const hasStructure =
    /<!doctype html>/i.test(normalized) &&
    /<html[\s>]/i.test(normalized) &&
    /<\/html>/i.test(normalized);
  const hasRemoteScript = /<script[^>]+src=["']https?:/i.test(normalized);
  const hasJsUrl = /javascript:/i.test(normalized);
  const interactive = hasInteractable(normalized);

  const checks: GateCheck[] = [
    {
      id: "nonempty",
      name: "产物非空",
      passed: normalized.trim().length > 80,
      message:
        normalized.trim().length > 80
          ? "HTML 产物长度正常"
          : "产物过短，疑似生成失败",
    },
    {
      id: "doctype",
      name: "预览器格式 / 文档结构",
      passed: hasStructure,
      message: hasStructure
        ? "符合单页 HTML 预览输入格式"
        : "缺少 DOCTYPE / html，预览器无法可靠加载",
    },
    {
      id: "interactive",
      name: "可交互性",
      passed: interactive,
      message: interactive
        ? "检测到可点击交互元素"
        : "未检测到 button/select/表单/锚点交互",
    },
    {
      id: "no-script-remote",
      name: "远程脚本拦截",
      passed: !hasRemoteScript,
      message: hasRemoteScript
        ? "检测到外部 script src，禁止发布"
        : "未发现外部脚本引用",
    },
    {
      id: "no-js-url",
      name: "危险协议拦截",
      passed: !hasJsUrl,
      message: hasJsUrl ? "检测到 javascript: 协议" : "未发现危险协议",
    },
    {
      id: "size",
      name: "产物体积",
      passed: sizeKb < 500,
      message:
        sizeKb < 500 ? `体积 ${sizeKb.toFixed(1)} KB` : "产物超过 500KB 上限",
    },
  ];

  if (isOpsLike(normalized)) {
    const slos = extractSloPercents(normalized);
    if (slos.length === 0) {
      checks.push({
        id: "ops-slo",
        name: "运维 SLO 指标",
        passed: false,
        message: "检测到运维看板特征，但未解析到 SLO 百分比",
      });
    } else {
      const worst = Math.min(...slos);
      const passed = worst >= SLO_MIN;
      checks.push({
        id: "ops-slo",
        name: "运维 SLO 发布阈值",
        passed,
        message: passed
          ? `最差 SLO ${worst}% ≥ 阈值 ${SLO_MIN}%`
          : `最差 SLO ${worst}% < 阈值 ${SLO_MIN}%，禁止发布`,
      });
    }
  }

  const ok = checks.every((c) => c.passed);
  const hint = fixHint(checks);

  return {
    ok,
    checks,
    hint: hint || undefined,
  };
}
