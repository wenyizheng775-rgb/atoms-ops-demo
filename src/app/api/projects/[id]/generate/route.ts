import { NextResponse } from "next/server";
import { getProject } from "@/lib/store";
import { runBuildPipeline } from "@/lib/orchestrator";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;

  const rl = checkRateLimit(`gen:${clientKeyFromRequest(req)}`);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error: `调用过于频繁，请 ${rl.retryAfterSec}s 后重试（防止额度被打满）。`,
      },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      },
    );
  }

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "未找到项目" }, { status: 404 });
  }

  if (project.status === "building") {
    return NextResponse.json(
      { error: "该项目正在构建中，请稍候再试" },
      { status: 409 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const isRevise = project.versions.length > 0;
  const prompt = (body.prompt?.trim() || project.prompt).trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
  }

  try {
    const updated = await runBuildPipeline(
      id,
      prompt,
      isRevise ? "revise" : "create",
    );
    return NextResponse.json({ project: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
