import { NextResponse } from "next/server";
import { publishProject } from "@/lib/orchestrator";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const project = await publishProject(id);
    return NextResponse.json({
      project,
      publicUrl: `/p/${project.id}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
