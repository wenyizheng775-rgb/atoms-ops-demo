import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createProject, listProjects } from "@/lib/store";

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const projects = await listProjects(user.id);
  return NextResponse.json({ projects });
}

export async function POST(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const body = (await req.json()) as { name?: string; prompt?: string };
  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt 必填" }, { status: 400 });
  }
  const name =
    body.name?.trim() ||
    prompt.slice(0, 24).replace(/\s+/g, " ") + (prompt.length > 24 ? "…" : "");

  const project = await createProject({ name, prompt, ownerId: user.id });
  return NextResponse.json({ project }, { status: 201 });
}
