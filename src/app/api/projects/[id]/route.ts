import { NextResponse } from "next/server";
import { requireOwnedProject } from "@/lib/access";
import { deleteProject } from "@/lib/store";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireOwnedProject(req, id);
  if (result.error) return result.error;
  return NextResponse.json({ project: result.project });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const result = await requireOwnedProject(req, id);
  if (result.error) return result.error;
  try {
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
