const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const DEFAULT_TIMEOUT_MS = Number(process.env.DEEPSEEK_TIMEOUT_MS || 90_000);

export async function chatCompletion(params: {
  system: string;
  user: string;
  temperature?: number;
  timeoutMs?: number;
}): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "缺少 DEEPSEEK_API_KEY。请在 .env.local 中配置后重启开发服务器。",
    );
  }

  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        temperature: params.temperature ?? 0.4,
        messages: [
          { role: "system", content: params.system },
          { role: "user", content: params.user },
        ],
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      const brief = text.slice(0, 240);
      throw new Error(`DeepSeek API 错误 ${res.status}: ${brief}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("DeepSeek 返回为空");
    return content;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(
        `DeepSeek 调用超时（>${Math.round(timeoutMs / 1000)}s）。请重试或简化需求。`,
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function extractHtml(raw: string): string {
  const fenced = raw.match(/```html\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const bare = raw.match(/<!doctype html[\s\S]*<\/html>/i);
  if (bare?.[0]) return bare[0].trim();

  const start = raw.search(/<!doctype html|<html[\s>]/i);
  if (start >= 0) return raw.slice(start).trim();

  return raw.trim();
}

export function isVisualOverhaulRequest(prompt: string): boolean {
  return /科技|赛博|未来|暗黑|深色|霓虹|炫|视觉|风格|配色|主题|高级感|质感|重做|换皮|好看|酷|tech|cyber|dark|neon/i.test(
    prompt,
  );
}

export const BUILD_SYSTEM = `你是 Atoms Ops Demo 中的 Builder Agent。
任务：根据用户需求，生成一个可独立运行的单页 HTML 应用（单文件产物）。

硬性要求：
1. 必须输出完整 HTML5 文档：以 <!DOCTYPE html> 开头，以 </html> 结束；CSS 在 <style>，JS 在 <script>。
2. 不要引用外部 JS CDN / 外部 script src；可用 Google Fonts 或系统字体。
3. UI 要有真实可点击交互（导航锚点、筛选、表单校验、tab 等至少一种）。
4. 内容必须紧扣用户需求，不同需求要生成不同结构与文案，禁止套用固定模板。
5. 只输出 HTML（或 \`\`\`html 代码块），不要解释。`;

export const REVISE_SYSTEM = `你是 Builder Agent。用户要对已有单页 HTML 做修改。

硬性要求：
1. 输出完整 HTML5 文档（<!DOCTYPE html> … </html>），不要只输出片段。
2. 无外部 script src；保留或增强可点击交互。
3. 若用户要求风格/科技感/换皮：必须肉眼可见大改（背景、主色、布局至少同时变）。
4. 若用户只改文案/加模块：真正改到内容，不要原样返回。
5. 只输出完整 HTML，不要解释。`;

export function buildReviseUserPrompt(
  userPrompt: string,
  currentHtml: string,
): string {
  const overhaul = isVisualOverhaulRequest(userPrompt);
  const hint = overhaul
    ? `\n【强制】视觉大改：重绘整页，禁止微调。\n`
    : "\n【强制】必须相对当前 HTML 做出可观察的差异，禁止原样返回。\n";

  const clipped =
    currentHtml.length > 28000
      ? `${currentHtml.slice(0, 28000)}\n<!-- truncated -->`
      : currentHtml;

  return `【用户修改指令】\n${userPrompt}${hint}\n【当前 HTML】\n${clipped}`;
}
