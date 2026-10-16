import { NextResponse } from "next/server";
import { requireOwnedProject } from "@/lib/access";
import { rollbackProject } from "@/lib/orchestrator";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireOwnedProject(req, id);
  if (result.error) return result.error;
  const body = (await req.json()) as { versionId?: string };
  if (!body.versionId) {
    return NextResponse.json({ error: "versionId 必填" }, { status: 400 });
  }
  try {
    const project = await rollbackProject(id, body.versionId);
    return NextResponse.json({ project });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
